from pydantic import BaseModel


class BatchExportRequest(BaseModel):
    application_ids: list[str]
    theme: str = "modern"
