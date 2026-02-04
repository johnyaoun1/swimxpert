import { Injectable, signal } from '@angular/core';

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

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private readonly ATTENDANCE_KEY = 'swimxpert_attendance';
  attendance = signal<Attendance[]>([]);

  constructor() {
    this.loadAttendance();
    // Initialize with some mock data if empty
    if (this.attendance().length === 0) {
      this.initializeMockData();
    }
  }

  private loadAttendance(): void {
    const attendanceStr = localStorage.getItem(this.ATTENDANCE_KEY);
    if (attendanceStr) {
      try {
        this.attendance.set(JSON.parse(attendanceStr));
      } catch (e) {
        console.error('Error loading attendance', e);
        this.attendance.set([]);
      }
    }
  }

  private saveAttendance(): void {
    localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(this.attendance()));
  }

  private initializeMockData(): void {
    const mockAttendance: Attendance[] = [
      {
        id: '1',
        sessionId: '1',
        childId: '1',
        childName: 'Emma',
        clientId: '2',
        clientName: 'Alex',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        status: 'present',
        checkInTime: '09:55',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '2',
        sessionId: '2',
        childId: '1',
        childName: 'Emma',
        clientId: '2',
        clientName: 'Alex',
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        checkInTime: '09:58',
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        sessionId: '3',
        childId: '3',
        childName: 'Olivia',
        clientId: '3',
        clientName: 'Sarah',
        date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        status: 'absent',
        notes: 'Client canceled',
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        id: '4',
        sessionId: '4',
        childId: '4',
        childName: 'Noah',
        clientId: '4',
        clientName: 'Mike',
        date: new Date().toISOString().split('T')[0],
        status: 'late',
        checkInTime: '16:15',
        notes: 'Arrived 15 minutes late',
        createdAt: new Date().toISOString()
      }
    ];
    this.attendance.set(mockAttendance);
    this.saveAttendance();
  }

  recordAttendance(attendance: Omit<Attendance, 'id' | 'createdAt'>): Attendance {
    const newAttendance: Attendance = {
      ...attendance,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    this.attendance.update(records => [...records, newAttendance]);
    this.saveAttendance();
    return newAttendance;
  }

  updateAttendance(attendanceId: string, updates: Partial<Attendance>): void {
    this.attendance.update(records =>
      records.map(a => a.id === attendanceId ? { ...a, ...updates } : a)
    );
    this.saveAttendance();
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
}
