import os
import dashscope
from typing import List

def get_embeddings(texts: List[str]) -> List[List[float]]:
    if os.getenv("MOCK_EMBEDDINGS") == "1":
        # Mock mode for tests
        return [[0.1] * 1024 for _ in texts]
        
    dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")
    if not dashscope.api_key:
        raise ValueError("DASHSCOPE_API_KEY environment variable is required")
        
    resp = dashscope.TextEmbedding.call(
        model=dashscope.TextEmbedding.Models.text_embedding_v3,
        input=texts
    )
    
    if resp.status_code == 200:
        embeddings = []
        for embedding in resp.output["embeddings"]:
            embeddings.append(embedding["embedding"])
        return embeddings
    else:
        raise Exception(f"DashScope API Error: {resp.code} - {resp.message}")