"""VEKTRA backend.

End-to-end pipeline:
  Chat messages -> 9Router LLM (raw SVG) -> FastAPI returns {"svg": "..."}
  Frontend consumes the SVG and loads it into the Fabric.js canvas.
  The full message history is forwarded to the LLM on every turn so it
  can refine its previous design in a continuous conversation.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from typing import List, Dict
import json
import re
from layout_templates import buildLayoutPromptReference

# --- Pydantic Schemas ---


class VectorSVGResponse(BaseModel):
    """Response schema for a single raw SVG document."""

    svg: str


class ChatMessage(BaseModel):
    """A single turn in the conversation history."""

    role: str   # "user" | "assistant"
    content: str


class CanvasElement(BaseModel):
    """Schema for an active layer object or uploaded image on canvas."""

    name: str = ""
    type: str = ""
    width: float = 0
    height: float = 0
    x: float = 0
    y: float = 0
    text: str = ""


class ChatRequest(BaseModel):
    """Request payload — full conversation history sent on every turn."""

    messages: List[ChatMessage]
    canvas_width: int = 800   # dimensi canvas yang sedang aktif di editor
    canvas_height: int = 600  # dikirim dari frontend setiap kali generate
    canvas_elements: List[CanvasElement] = []


import os

# --- App Setup ---

app = FastAPI(title="VEKTRA")

# CORS setup — allow Vercel frontend, local dev, or environment configured origins
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "service": "VEKTRA AI Vector Engine", "version": "1.0.0"}

# --- OpenAI Client (9Router / OpenRouter / Custom LLM API) ---

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:20128/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-770dd69ddc51d4f9-1q0hhd-e01d53f6")

client = OpenAI(
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY,
)

SYSTEM_PROMPT = """You are a Senior Graphic Designer and expert in SVG illustration.

Given a user prompt, generate a COMPLETE, HIGHLY-AESTHETIC, PRODUCTION-QUALITY raw SVG document.

Dynamic Canvas & Composition:
- Analyze the user's prompt and intended format (e.g., logo, banner, flyer, poster).
- Set the `viewBox` width and height appropriately (e.g., `viewBox="0 0 1080 1080"` for square designs/logos, `viewBox="0 0 1200 628"` for landscape banners, `viewBox="0 0 800 1200"` for portrait posters).

AUTONOMOUS HYBRID RENDERING (CRUCIAL):
Analyze the user's prompt to determine whether it asks for real-world objects (e.g., realistic food, human faces, photography) or abstract/vector designs.
1. **Auto-Image Injection**: If the prompt requires realistic elements that are difficult or impractical to render purely with SVG vector paths, you MUST embed a high-quality raster image using an SVG `<image>` tag.
   - Use this free generation URL format: `<image href="https://image.pollinations.ai/prompt/{highly_detailed_prompt}?width={w}&height={h}&nologo=true" x="..." y="..." width="..." height="..." preserveAspectRatio="xMidYMid slice" />`
   - The `{highly_detailed_prompt}` MUST be URL-encoded, highly descriptive, and written in English (e.g., `hyper-realistic-delicious-burger-studio-lighting-4k-high-resolution`).
2. **Explicit Override**: If the user explicitly uses keywords like "full svg", "vector only", "flat design", or "no images", DO NOT use any `<image>` tags. Rely strictly on pure SVG primitives (`<path>`, `<circle>`, `<rect>`, etc.).

Core Design Guidelines:
- Combine any injected `<image>` seamlessly with premium vector shapes, frame overlays, backgrounds, and typography.
- Make creative use of SVG `<defs>` with `<linearGradient>` and `<radialGradient>` for depth and visual appeal.
- Typography is paramount: use clean `<text>` tags with explicit `font-family`, `font-size`, `font-weight`, `fill`, and `text-anchor`.
- FABRIC.JS CANVAS COMPATIBILITY: Use explicit inline presentation attributes (`fill="..."`, `stroke="..."`, `font-family="..."`) on elements rather than CSS `<style>` class rules. For `<image>` elements, provide explicit `x`, `y`, `width`, `height`, and `href`.
- Ensure all elements are beautifully scaled within your `viewBox` bounds with no overflows.
- Keep SVG XML syntax clean and valid (escape special characters such as `&` as `&amp;`).

When refining an existing design (if given a prior SVG in history):
- Incorporate the user's feedback while preserving overall structure. DO NOT change existing `viewBox` dimensions unless explicitly requested.

Output ONLY the raw SVG string. No markdown code fences, no XML/JSON wrappers, no explanations. Return the `<svg>` markup starting on the first line."""




def clean_svg(raw: str) -> str:
    """Strip markdown code fences, stray JSON wrappers, and prose text to return valid SVG XML."""
    raw = raw.strip()

    # 1. Remove triple-backtick code fences (```xml, ```svg, or plain ```).
    fence = re.search(r"```(?:xml|svg|html)?\s*(.*?)```", raw, re.DOTALL)
    if fence:
        raw = fence.group(1).strip()

    # 2. Fallback: JSON wrapper
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and "svg" in data:
                raw = str(data["svg"]).strip()
        except json.JSONDecodeError:
            pass

    # 3. Strictly extract from first `<svg` to last `</svg>`
    svg_match = re.search(r"<svg.*?</svg>", raw, re.DOTALL | re.IGNORECASE)
    if svg_match:
        raw = svg_match.group(0).strip()

    # 4. Escape unescaped ampersands in attributes/text (prevent XML parse errors)
    raw = re.sub(r'&(?!(amp|lt|gt|quot|apos);)', '&amp;', raw)

    # 5. Ensure <image> tags have crossorigin="anonymous" attribute for Fabric canvas CORS compatibility
    raw = re.sub(r'<image(?![^>]*crossorigin=)', r'<image crossorigin="anonymous"', raw)

    return raw


@app.post("/api/generate", response_model=VectorSVGResponse)
async def generate_design(request: ChatRequest):
    """Generate or refine an SVG via continuous chat history.

    The frontend passes the full conversation (user + assistant turns).
    We prepend the system prompt and forward everything to the LLM so it
    can refine previous designs based on the ongoing dialogue.
    """
    if not request.messages:
        raise HTTPException(status_code=422, detail="messages array must not be empty")

    # Inject viewBox yang sesuai dengan ukuran canvas editor ke system prompt.
    # Ini menggantikan bagian "Dynamic Canvas" — LLM tidak perlu menebak lagi.
    canvas_instruction = (
        f"\n\nCANVAS CONSTRAINT (MANDATORY): "
        f"The user's canvas is currently set to {request.canvas_width}×{request.canvas_height} px. "
        f"You MUST use exactly `viewBox=\"0 0 {request.canvas_width} {request.canvas_height}\"` "
        f"on the root `<svg>` element. "
        f"Scale ALL design elements, typography, and layout proportionally to fill this viewBox. "
        f"Never use any other viewBox dimensions."
    )

    elements_instruction = ""
    if request.canvas_elements:
        elements_instruction = "\n\nUSER CANVAS ELEMENTS & UPLOADED IMAGES:\nThe user's canvas currently contains the following named elements/layers:\n"
        for elem in request.canvas_elements:
            desc = f"- Layer Name: {elem.name!r}, Type: {elem.type!r}, Pos: ({elem.x:.0f},{elem.y:.0f}), Size: ({elem.width:.0f}x{elem.height:.0f})"
            if elem.text:
                desc += f", Text: {elem.text!r}"
            elements_instruction += desc + "\n"
        elements_instruction += (
            "CRITICAL INSTRUCTION FOR NAMED LAYERS & UPLOADED IMAGES:\n"
            "If the user asks to position, align, frame, or modify around a specific layer or uploaded image "
            "(e.g., 'pindahkan logo_perusahaan', 'tambah frame di foto_produk'), refer to these layer names and coordinates in your design."
        )

    mentioned_instruction = ""
    last_user_msg = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
    mentions = re.findall(r'@([a-zA-Z0-9_\-]+)', last_user_msg)
    if mentions:
        m_list = ", ".join(['@' + m for m in mentions])
        mentioned_instruction = (
            f"\n\nHIGH PRIORITY MENTION & LAYOUT RE-POSITIONING DIRECTIVE (MANDATORY):\n"
            f"The user explicitly mentioned the following layer(s): {m_list}.\n"
            f"INSTRUCTIONS FOR RE-POSITIONING MENTIONED LAYERS:\n"
            f"1. You MUST position/align the layout around the mentioned layer(s) based on the user's request (e.g. if asked to move to top-right, place at x=canvas_width-150, y=20).\n"
            f"2. For EACH mentioned layer, you MUST output an SVG element (e.g. `<image id=\"{mentions[0]}\" x=\"650\" y=\"20\" width=\"120\" height=\"120\" href=\"...\" />` or `<g id=\"{mentions[0]}\" ...>`) with attribute `id=\"{mentions[0]}\"` matching the layer name EXACTLY.\n"
            f"3. The canvas engine will automatically bind the user's uploaded image or layer object to the new `x`, `y`, `width`, and `height` specified by your `id=\"{mentions[0]}\"` SVG element.\n"
        )
    elif request.canvas_elements:
        mentioned_instruction = (
            "\n\nEXISTING LAYERS INSTRUCTION:\n"
            "If you incorporate or place any existing named layers from the user canvas, set `id=\"<layer_name>\"` on the corresponding SVG element.\n"
        )

    layout_reference_prompt = buildLayoutPromptReference()
    system_prompt_with_canvas = SYSTEM_PROMPT + canvas_instruction + elements_instruction + mentioned_instruction + layout_reference_prompt

    # Build the full messages list: system prompt first, then history
    llm_messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt_with_canvas}
    ] + [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        model_name = os.getenv("MODEL_NAME", "gemini-2.0-flash")
        response = client.chat.completions.create(
            model=model_name,
            messages=llm_messages,
            temperature=0.7,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    raw = response.choices[0].message.content or ""

    svg = clean_svg(raw)
    if not svg.startswith("<svg"):
        raise HTTPException(
            status_code=500,
            detail=f"LLM did not return a valid SVG document. Raw start: {svg[:200]!r}",
        )

    return VectorSVGResponse(svg=svg)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)