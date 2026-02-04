import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Location {
  id: number;
  name: string;
  address: string;
  phone: string;
  hours: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.scss']
})
export class LocationsComponent {
  locations: Location[] = [
    {
      id: 1,
      name: 'Downtown Location',
      address: '123 Main Street, Downtown District, City, State 12345',
      phone: '(555) 123-4567',
      hours: 'Mon-Fri: 9AM-7PM, Sat-Sun: 8AM-6PM',
      lat: 40.7589,
      lng: -73.9851
    },
    {
      id: 2,
      name: 'Westside Location',
      address: '456 Ocean Avenue, Westside, City, State 12345',
      phone: '(555) 234-5678',
      hours: 'Mon-Fri: 8AM-8PM, Sat-Sun: 9AM-5PM',
      lat: 40.7489,
      lng: -73.9680
    },
    {
      id: 3,
      name: 'Northside Location',
      address: '789 Park Boulevard, Northside, City, State 12345',
      phone: '(555) 345-6789',
      hours: 'Mon-Fri: 10AM-6PM, Sat-Sun: 9AM-4PM',
      lat: 40.7689,
      lng: -73.9920
    }
  ];
}
