"""Module for loading and managing SVG layout reference templates for system prompt."""

from pathlib import Path
from typing import Dict

# Path to templates directory
templatesDir = Path(__file__).parent / "templates"


def loadLayoutTemplates() -> Dict[str, str]:
    """Dynamically scan and read all .svg layout reference files from templatesDir."""
    layoutTemplates: Dict[str, str] = {}
    if not templatesDir.exists():
        return layoutTemplates

    for svgFile in sorted(templatesDir.glob("*.svg")):
        try:
            templateName = svgFile.stem.lower()
            content = svgFile.read_text(encoding="utf-8").strip()
            layoutTemplates[templateName] = content
        except Exception as err:
            print(f"[LayoutTemplates] Failed to read {svgFile.name}: {err}")

    return layoutTemplates


def buildLayoutPromptReference() -> str:
    """Format loaded SVG templates into system prompt reference instructions.
    
    The AI is instructed to use these layout zone blueprints ONLY as flexible 
    structural inspiration without being strictly forced to copy them.
    """
    templatesMap = loadLayoutTemplates()
    if not templatesMap:
        return ""

    promptLines = [
        "\n\nLAYOUT REFERENCE BLUEPRINTS & CREATIVE INSPIRATION:",
        "Below are optional layout zone templates for common design formats (banner, flyer, poster, etc.).",
        "",
        "CRITICAL INSTRUCTIONS FOR LAYOUT FLEXIBILITY & CREATIVITY:",
        "1. **Optional Guidance Only**: These SVG structures serve as spatial blueprints showing standard zone placement (e.g. logo, main headline, hero illustration, description, call-to-action).",
        "2. **Creative Freedom**: DO NOT strictly copy or force yourself to use these exact layout coordinates or shapes. You have full creative freedom to re-arrange elements, invent fresh compositions, alter section sizes, or design entirely unique layouts tailored to the user's prompt.",
        "3. **Adaptability**: Feel free to merge, remove, or transform layout zones based on the specific aesthetic or domain request (e.g. vintage poster vs futuristic cyber flyer vs minimal logo).",
        "",
        "--- START OF REFERENCE BLUEPRINTS ---",
    ]

    for templateName, svgContent in templatesMap.items():
        promptLines.append(f"\n[REFERENCE LAYOUT TEMPLATE: {templateName.upper()}]")
        promptLines.append(svgContent)

    promptLines.append("\n--- END OF REFERENCE BLUEPRINTS ---")

    return "\n".join(promptLines)
