---
title: 扁舟 (Ark Project)
slug: ark
visibility: public
---

# 扁舟 (Ark Project)

> 「在星际迷航与记忆回廊中穿行的黑客终端。」

这是一艘飞船。在星际空间中穿行，提供知识归档与检索。

## 系统概述
扁舟是一个基于语义向量检索与大模型问答的个人知识库系统。
采用纯黑白高对比、零圆角、零阴影的 ASCII 视窗卡片交互。

```python
# 示例语义检索核心调用
def vector_search(query: str, limit: int = 5):
    return db.query("SELECT * FROM chunks WHERE cosine_dist(vec, q) < 0.3")
```

## 交互指令
- 输入 `help` 查看可用指令列表
- 输入 `search <关键词>` 触发向量语义检索
- 输入 `open <slug>` 或 `cat <slug>` 打开对应卡片视窗
