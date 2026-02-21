import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Attendance {
  id: string;
  sessionId: string;
  childId: string;
  childName: string;
  clientId: string;
  clientName: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  notes?: string;
  createdAt: string;
}

interface ApiRegistration {
  id: number;
  swimmerId: number;
  trainingSessionId: number;
  sessionDate: string;
  isPresent: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private readonly apiUrl = 'http://localhost:5002/api/registrations';
  attendance = signal<Attendance[]>([]);

  constructor(private http: HttpClient) {}

  registerForSession(sessionId: string | number, swimmerId: string | number): Observable<Attendance> {
    return this.http.post<ApiRegistration>(this.apiUrl, {
      swimmerId: Number(swimmerId),
      trainingSessionId: Number(sessionId)
    }).pipe(
      map((registration) => this.fromApiRegistration(registration)),
      tap((registration) => this.attendance.update((records) => [...records, registration]))
    );
  }

  getSessionAttendees(sessionId: string | number): Observable<Attendance[]> {
    return this.http.get<any[]>(`${this.apiUrl}/session/${sessionId}`).pipe(
      map((rows) => rows.map((row) => this.fromSessionRow(row))),
      tap((rows) => this.attendance.set(rows))
    );
  }

  getAllRegistrations(): Observable<Attendance[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map((rows) => rows.map((row) => this.fromAdminRow(row))),
      tap((rows) => this.attendance.set(rows))
    );
  }

  getMySessions(swimmerId: string | number): Observable<Attendance[]> {
    return this.http.get<any[]>(`${this.apiUrl}/swimmer/${swimmerId}`).pipe(
      map((rows) => rows.map((row) => this.fromSwimmerRow(row, swimmerId))),
      tap((rows) => this.attendance.set(rows))
    );
  }

  markAttendance(registrationId: string | number, attended: boolean): Observable<Attendance> {
    return this.http.put<ApiRegistration>(`${this.apiUrl}/${registrationId}/attendance`, {
      isPresent: attended
    }).pipe(
      map((registration) => this.fromApiRegistration(registration)),
      tap((updated) =>
        this.attendance.update((records) => records.map((r) => (r.id === String(registrationId) ? updated : r)))
      )
    );
  }

  cancelRegistration(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.attendance.update((records) => records.filter((a) => a.id !== String(id))))
    );
  }

  recordAttendance(attendance: Omit<Attendance, 'id' | 'createdAt'>): Observable<Attendance> {
    if (!attendance.childId || !attendance.sessionId) {
      return throwError(() => new Error('childId and sessionId are required.'));
    }
    return this.registerForSession(attendance.sessionId, attendance.childId).pipe(
      map((created) => ({ ...created, ...attendance }))
    );
  }

  updateAttendance(attendanceId: string, updates: Partial<Attendance>): Observable<Attendance> {
    const attended = updates.status ? updates.status !== 'absent' : true;
    return this.markAttendance(attendanceId, attended).pipe(
      map((updated) => ({ ...updated, ...updates }))
    );
  }

  getAttendanceByClient(clientId: string): Attendance[] {
    return this.attendance().filter(a => a.clientId === clientId);
  }

  getAttendanceByChild(childId: string): Attendance[] {
    return this.attendance().filter(a => a.childId === childId);
  }

  getAttendanceByDateRange(startDate: string, endDate: string): Attendance[] {
    return this.attendance().filter(a => {
      const attendanceDate = new Date(a.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return attendanceDate >= start && attendanceDate <= end;
    });
  }

  getAttendanceStats(): {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  } {
    const records = this.attendance();
    return {
      present: records.filter(a => a.status === 'present').length,
      absent: records.filter(a => a.status === 'absent').length,
      late: records.filter(a => a.status === 'late').length,
      excused: records.filter(a => a.status === 'excused').length,
      total: records.length
    };
  }

  getAttendanceRate(): number {
    const stats = this.getAttendanceStats();
    if (stats.total === 0) return 0;
    return ((stats.present + stats.excused) / stats.total) * 100;
  }

  private fromApiRegistration(api: ApiRegistration): Attendance {
    return {
      id: String(api.id),
      sessionId: String(api.trainingSessionId),
      childId: String(api.swimmerId),
      childName: '',
      clientId: '',
      clientName: '',
      date: new Date(api.sessionDate).toISOString().split('T')[0],
      status: api.isPresent ? 'present' : 'absent',
      createdAt: api.createdAt
    };
  }

  private fromSessionRow(row: any): Attendance {
    return {
      id: String(row.id),
      sessionId: String(row.trainingSessionId || row.sessionId || ''),
      childId: String(row.swimmerId || ''),
      childName: row.swimmerName || '',
      clientId: '',
      clientName: '',
      date: row.sessionDate ? new Date(row.sessionDate).toISOString().split('T')[0] : '',
      status: row.isPresent ? 'present' : 'absent',
      createdAt: new Date().toISOString()
    };
  }

  private fromSwimmerRow(row: any, swimmerId: string | number): Attendance {
    return {
      id: String(row.id),
      sessionId: String(row.trainingSessionId || ''),
      childId: String(swimmerId),
      childName: '',
      clientId: '',
      clientName: '',
      date: row.sessionDate ? new Date(row.sessionDate).toISOString().split('T')[0] : '',
      status: row.isPresent ? 'present' : 'absent',
      createdAt: new Date().toISOString(),
      notes: row.sessionTitle
    };
  }

  private fromAdminRow(row: any): Attendance {
    return {
      id: String(row.id),
      sessionId: String(row.trainingSessionId || ''),
      childId: String(row.swimmerId || ''),
      childName: row.swimmerName || '',
      clientId: String(row.parentUserId || ''),
      clientName: row.parentName || '',
      date: row.sessionDate ? new Date(row.sessionDate).toISOString().split('T')[0] : '',
      status: row.isPresent ? 'present' : 'absent',
      createdAt: row.createdAt || new Date().toISOString(),
      notes: row.sessionTitle || '',
      checkInTime: row.startTime ? new Date(row.startTime).toISOString().slice(11, 16) : ''
    };
  }
}
