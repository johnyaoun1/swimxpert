import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Location {
  id: number;
  name: string;
  address: string;
  phone: string;
  hours: string;
  lat?: number;
  lng?: number;
  comingSoon?: boolean;
  hideMapLink?: boolean;
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
      name: 'Cap Sur Ville Country Club',
      address: 'Mar Roukoz, Dekwaneh, Beirut, Lebanon',
      phone: '+961 76 144 927',
      hours: 'Mon-Fri: 9:30AM-7:30PM, Sat: 9:30AM-6PM, Sun: 9AM-11AM',
      lat: 33.8724157,
      lng: 35.5581482
    },
    {
      id: 2,
      name: 'Tilal Fanar',
      address: 'Fanar, Beirut, Lebanon',
      phone: '+961 76 144 927',
      hours: 'Mon-Fri: 9:30AM-7:30PM, Sat: 9:30AM-6PM, Sun: 9AM-11AM',
      hideMapLink: true
    },
    {
      id: 3,
      name: 'Coming Soon',
      address: '',
      phone: '',
      hours: '',
      comingSoon: true
    }
  ];
}
