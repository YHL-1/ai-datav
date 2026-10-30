import { api } from "./api";

export interface DatasetSummary {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  rowCount: number;
  columns: string[];
  preview: Record<string, string>[];
  /** file = 上传文件；api = 外部实时接口 */
  kind: string;
  sourceUrl: string | null;
  refreshSeconds: number;
  createdAt: string;
}

export interface DatasetData {
  id: string;
  name: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, string>[];
  kind?: string;
  refreshSeconds?: number;
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const result = await api<{ datasets: DatasetSummary[] }>("/datasets");
  return result.datasets;
}

export async function uploadDataset(file: File): Promise<DatasetSummary> {
  const form = new FormData();
  form.append("file", file);
  const result = await api<{ dataset: DatasetSummary }>("/datasets", {
    method: "POST",
    body: form,
  });
  return result.dataset;
}

export async function deleteDataset(id: string): Promise<void> {
  await api(`/datasets/${id}`, { method: "DELETE" });
}

export async function createApiDataset(input: {
  name: string;
  url: string;
  refreshSeconds: number;
}): Promise<DatasetSummary> {
  const result = await api<{ dataset: DatasetSummary }>("/datasets/api", {
    method: "POST",
    body: input,
  });
  return result.dataset;
}

export async function getDatasetData(
  id: string,
  limit = 200,
): Promise<DatasetData> {
  return api<DatasetData>(`/datasets/${id}/data`, { query: { limit } });
}
