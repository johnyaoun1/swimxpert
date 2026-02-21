import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CaptureLeadPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  sourcePage?: string | null;
  sourceAction?: string | null;
  userAgent?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LeadCaptureService {
  private readonly apiUrl = 'http://localhost:5002/api/leads';

  constructor(private http: HttpClient) {}

  captureLead(payload: CaptureLeadPayload): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(`${this.apiUrl}/capture`, payload);
  }
}
