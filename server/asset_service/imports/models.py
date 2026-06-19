from pydantic import BaseModel

class ImportRequest(BaseModel):
    csv_content: str
    import_type: str = "assets"
