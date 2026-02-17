def build_prompt(dataset_metadata: str, user_question: str):
    return f"""
You are an AI dataset assistant.

Dataset Metadata:
{dataset_metadata}

User Question:
{user_question}

If the question requires data retrieval, generate a SQL SELECT query.
Otherwise, provide explanation.

Respond strictly in JSON format.

If explanation:
{{
  "type": "text",
  "message": "..."
}}

If SQL required:
{{
  "type": "sql",
  "query": "SELECT ..."
}}
"""
