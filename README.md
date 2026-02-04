# SwimXpert - Swimming Academy Website

A complete Angular 17+ website for a professional swimming academy with comprehensive features for managing swim lessons, student progress, and academy information.

## Features

### Pages & Routes
- **Home Page**: Hero section with featured information and call-to-action buttons
- **About Us**: Information about the academy, mission, and approach
- **Locations**: List of pool locations with map integration
- **Swim Lessons**: Detailed information about all 6 swim levels
- **Level Finder**: Interactive quiz to determine the appropriate swim level for children
- **Contact Us**: Contact form with map integration
- **Gallery**: Image gallery with clickable images
- **Login/Signup**: User authentication system
- **Dashboard**: Client account to track children's progress and manage profiles

### Swim Levels
1. **Level 1 - Early Swim Lessons**: Water comfort and confidence building
2. **Level 2 - Beginner Swim Lessons**: Independent buoyancy and simple movement
3. **Level 3 - Beginner-Intermediate**: Independent swimming with coordination
4. **Level 4 - Intermediate**: Coordinated strokes and stamina
5. **Level 5 - Advanced**: Stroke refinement and endurance
6. **Level 6 - Advanced for Older Kids**: Master strokes and competitive preparation

### Key Features
- ✅ Responsive design (mobile and desktop)
- ✅ Modern UI with Tailwind CSS
- ✅ Form validations
- ✅ Level Finder with intelligent placement logic
- ✅ User authentication (mock/local storage)
- ✅ Progress tracking for children
- ✅ Profile picture support
- ✅ Smooth animations and transitions
- ✅ SEO-friendly meta tags

## Technology Stack

- **Angular 17+** (Standalone components)
- **TypeScript**
- **Tailwind CSS** for styling
- **RxJS** for reactive programming
- **Angular Forms** (Reactive Forms)

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:4200
```

### Build for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

```
swimxpert/
├── src/
│   ├── app/
│   │   ├── guards/          # Route guards
│   │   ├── pages/           # Page components
│   │   │   ├── home/
│   │   │   ├── about/
│   │   │   ├── locations/
│   │   │   ├── swim-lessons/
│   │   │   ├── level-finder/
│   │   │   ├── contact/
│   │   │   ├── gallery/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── dashboard/
│   │   ├── services/        # Services (auth, level-finder, etc.)
│   │   ├── shared/          # Shared components (header, footer)
│   │   ├── app.component.ts
│   │   └── app.routes.ts
│   ├── assets/              # Static assets
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Level Finder Logic

The Level Finder uses a sophisticated algorithm to determine the appropriate swim level based on:
- Child's age (age 3 automatically starts at Level 1)
- Answers to 13 skill assessment questions
- Progressive skill requirements

The placement logic ensures children are placed at the appropriate level for their current abilities.

## Authentication

The application uses a mock authentication system that stores user data in localStorage. In a production environment, this should be replaced with a proper backend API and JWT tokens.

## Dashboard Features

- Add multiple children to track
- Upload profile pictures (via URL)
- Track progress with entries including:
  - Level progression
  - Date stamps
  - Notes
  - Skills learned
- View progress history for each child

## Styling

The project uses Tailwind CSS with a custom color scheme:
- Primary colors: Blue tones
- Accent colors: Cyan/teal tones
- Custom animations for fade-in and slide-up effects

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Code Style
- Follow Angular style guide
- Use TypeScript strict mode
- Standalone components (no NgModules)

### Adding New Features
1. Create components in appropriate directories
2. Add routes in `app.routes.ts`
3. Create services for business logic
4. Update navigation in header component

## License

This project is created for educational/demonstration purposes.

## Contact

For questions or support, please use the contact form on the website.
