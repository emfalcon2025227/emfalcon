/**
 * OCR V2 Diagnostic Trace Engine
 * Emirates Falcon ERP — Phase 57-H.12
 */

export class OCRV2Diagnostics {
  private checkpoints: Array<{ id: string; name: string; status: "PASS" | "FAIL" | "SKIPPED"; latencyMs: number; details?: string }> = [];
  private startTime: number = Date.now();

  addCheckpoint(id: string, name: string, status: "PASS" | "FAIL" | "SKIPPED", details?: string) {
    const latencyMs = Date.now() - this.startTime;
    this.checkpoints.push({ id, name, status, latencyMs, details });
  }

  getCheckpoints() {
    return this.checkpoints;
  }
}
