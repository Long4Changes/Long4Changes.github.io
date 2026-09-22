import yaml
import re

def parse_markdown(content: str):
    yaml_pattern = r"^---\\s*\\n(.*?)\\n---\\s*\\n(.*)"
    match = re.search(yaml_pattern, content, re.DOTALL)
    
    metadata = {}
    markdown_text = content
    
    if match:
        yaml_str = match.group(1)
        try:
            metadata = yaml.safe_load(yaml_str) or {}
        except yaml.YAMLError:
            pass
        markdown_text = match.group(2)
        
    return {
        "title": metadata.get("title", "Untitled"),
        "slug": metadata.get("slug", "untitled"),
        "visibility": metadata.get("visibility", "public"),
        "content": markdown_text.strip()
    }