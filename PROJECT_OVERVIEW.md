# SwimXpert - Project Overview

## 📁 Project Tree Structure

```
swimxpert/
├── angular.json                    # Angular project configuration
├── package.json                    # Dependencies and scripts
├── package-lock.json               # Locked dependency versions
├── postcss.config.js              # PostCSS configuration for Tailwind
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript configuration
├── tsconfig.app.json              # TypeScript app configuration
├── README.md                       # Project documentation
│
└── src/
    ├── index.html                 # Main HTML entry point
    ├── main.ts                    # Angular bootstrap file
    ├── styles.css                 # Global styles & Tailwind directives
    ├── favicon.ico                # Site favicon
    │
    ├── assets/                    # Static assets (images, fonts, etc.)
    │
    └── app/
        ├── app.component.ts       # Root component
        ├── app.component.html     # Root template
        ├── app.component.scss     # Root styles
        ├── app.routes.ts          # Application routing configuration
        │
        ├── guards/
        │   └── auth.guard.ts      # Route guard for authentication
        │
        ├── pipes/
        │   └── safe-url.pipe.ts   # Safe URL pipe for PDF viewing
        │
        ├── services/
        │   ├── auth.service.ts           # Authentication & user management
        │   ├── contact.service.ts        # Contact form submissions
        │   ├── level-finder.service.ts   # Swim level determination logic
        │   ├── seo.service.ts           # SEO meta tags management
        │   └── swim-levels.service.ts   # Swim levels data provider
        │
        ├── shared/
        │   ├── header/
        │   │   ├── header.component.ts
        │   │   ├── header.component.html
        │   │   └── header.component.scss
        │   └── footer/
        │       ├── footer.component.ts
        │       ├── footer.component.html
        │       └── footer.component.scss
        │
        └── pages/
            ├── home/
            │   ├── home.component.ts
            │   ├── home.component.html
            │   └── home.component.scss
            │
            ├── about/
            │   ├── about.component.ts
            │   ├── about.component.html
            │   └── about.component.scss
            │
            ├── locations/
            │   ├── locations.component.ts
            │   ├── locations.component.html
            │   └── locations.component.scss
            │
            ├── swim-lessons/
            │   ├── swim-lessons.component.ts
            │   ├── swim-lessons.component.html
            │   └── swim-lessons.component.scss
            │
            ├── level-finder/
            │   ├── level-finder.component.ts
            │   ├── level-finder.component.html
            │   └── level-finder.component.scss
            │
            ├── contact/
            │   ├── contact.component.ts
            │   ├── contact.component.html
            │   └── contact.component.scss
            │
            ├── gallery/
            │   ├── gallery.component.ts
            │   ├── gallery.component.html
            │   └── gallery.component.scss
            │
            ├── certificates/
            │   ├── certificates.component.ts
            │   ├── certificates.component.html
            │   └── certificates.component.scss
            │
            ├── login/
            │   ├── login.component.ts
            │   ├── login.component.html
            │   └── login.component.scss
            │
            ├── signup/
            │   ├── signup.component.ts
            │   ├── signup.component.html
            │   └── signup.component.scss
            │
            └── dashboard/
                ├── dashboard.component.ts
                ├── dashboard.component.html
                └── dashboard.component.scss
```

---

## 🌐 Website Content & Functionality

### **Public Pages (No Authentication Required)**

#### 1. **Home Page** (`/`)
- **Purpose**: Landing page and introduction to SwimXpert
- **Features**:
  - Hero section with call-to-action buttons
  - "Why Choose SwimXpert?" section with 3 feature cards
  - Level finder promotion section
  - Sign-up call-to-action
  - Animated gradient backgrounds
  - Floating decorative elements

#### 2. **About Us** (`/about`)
- **Purpose**: Information about the swimming academy
- **Content**:
  - Mission statement
  - Teaching approach and methodology
  - Instructor qualifications
  - Facility information
  - "Why Choose Us?" section with 4 benefit cards
- **Design**: Premium containers with gradient text

#### 3. **Locations** (`/locations`)
- **Purpose**: Display all academy locations
- **Features**:
  - Location cards with:
    - Location name
    - Full address
    - Phone number
    - Business hours
    - "View on Map" link (Google Maps)
  - Interactive Google Maps embed
  - Status indicators (green dot for open locations)
- **Data**: 3 sample locations with coordinates

#### 4. **Swim Lessons** (`/swim-lessons`)
- **Purpose**: Display the 6-level swim program curriculum
- **Content**: For each level (1-6):
  - Level number and title
  - Goal description
  - Requirements list
  - Skill focus areas
  - Session duration
- **Design**: Premium cards with gradient borders and hover effects

#### 5. **Level Finder** (`/level-finder`)
- **Purpose**: Interactive quiz to determine appropriate swim level
- **Functionality**:
  - Age input (3-18 years)
  - 5 yes/no questions about swimming abilities:
    1. Can the child float on their back?
    2. Can the child swim freestyle for 10 meters?
    3. Can the child tread water for 30 seconds?
    4. Can the child swim backstroke?
    5. Can the child dive and swim underwater?
  - Complex algorithm determines level (1-6) based on answers
  - Results display with:
    - Recommended level
    - Level title and goal
    - Next steps information
    - "Apply Now" and "Start Over" buttons
- **Logic**: Handles edge cases, null values, and age-based defaults

#### 6. **Contact Us** (`/contact`)
- **Purpose**: Contact form and business information
- **Features**:
  - Contact form with validation:
    - Name (required)
    - Email (required, validated)
    - Message (required)
  - Business information:
    - Phone number
    - Email address
    - Physical address
    - Business hours (Mon-Sun)
  - Google Maps embed
  - Form submission handling with success message

#### 7. **Gallery** (`/gallery`)
- **Purpose**: Visual showcase of facilities and activities
- **Features**:
  - Grid layout of image cards
  - Click to view full image
  - Image titles and descriptions
  - Placeholder images with gradient backgrounds
  - Responsive grid (1-3 columns based on screen size)

#### 8. **Certificates** (`/certificates`)
- **Purpose**: Display professional certifications
- **Features**:
  - 4 certificate cards with:
    - Certificate title
    - Description
    - View button
    - Download button
  - Full-screen PDF viewer modal
  - Safe URL pipe for secure PDF rendering
  - Certificate types:
    1. Swimming Instructor Certification
    2. Lifeguard Certification
    3. Water Safety Instructor
    4. Competitive Swimming Coach

#### 9. **Login** (`/login`)
- **Purpose**: User authentication
- **Features**:
  - Email and password form
  - Form validation
  - Error handling
  - Redirect to dashboard on success
  - Redirect to signup page link

#### 10. **Sign Up** (`/signup`)
- **Purpose**: New user registration
- **Features**:
  - Registration form with:
    - Name
    - Email
    - Password
    - Confirm Password
  - Form validation
  - Password matching validation
  - Auto-login after registration
  - Redirect to dashboard

---

### **Protected Pages (Authentication Required)**

#### 11. **Dashboard** (`/dashboard`)
- **Purpose**: User dashboard for managing children's progress
- **Features**:
  - Welcome message with user name
  - **Add Child** functionality:
    - Child's name
    - Age (3-18)
    - Current swim level (1-6)
    - Optional profile picture URL
  - **Child Cards** displaying:
    - Profile picture (with fallback to initial)
    - Name and age
    - Current level badge
    - Progress history timeline
  - **Add Progress Entry** modal:
    - Level selection
    - Date picker
    - Notes textarea
    - Skills (comma-separated)
  - Progress entries show:
    - Date
    - Level
    - Notes
    - Skills as badges
  - Empty state when no children added
- **Data Persistence**: Uses localStorage via AuthService

---

### **Shared Components**

#### **Header** (Navigation Bar)
- **Features**:
  - Logo with hover animation
  - Navigation links:
    - Home, About, Locations, Swim Lessons, Level Finder, Gallery, Certificates, Contact
  - Authentication buttons:
    - Login/Sign Up (when not authenticated)
    - Dashboard/Logout (when authenticated)
  - Mobile-responsive hamburger menu
  - Active route highlighting
  - Glassmorphism design with backdrop blur

#### **Footer**
- **Features**:
  - 4-column layout:
    - Company info
    - Quick links
    - Resources
    - Contact information
  - Social links (placeholder)
  - Copyright notice with dynamic year
  - Gradient background with floating elements

---

## 🔧 Services & Functionality

### **1. AuthService** (`auth.service.ts`)
- **Responsibilities**:
  - User registration
  - User login/logout
  - Session management (localStorage)
  - Current user state (signals)
  - Child management:
    - Add child
    - Update child
    - Add progress entries
  - Authentication status checking

### **2. LevelFinderService** (`level-finder.service.ts`)
- **Responsibilities**:
  - Complex level determination algorithm
  - Handles age-based defaults
  - Processes question answers
  - Returns appropriate swim level (1-6)
  - Edge case handling

### **3. SwimLevelsService** (`swim-levels.service.ts`)
- **Responsibilities**:
  - Provides swim level data
  - 6 levels with:
    - Title
    - Goal
    - Requirements
    - Skill focus areas
    - Duration

### **4. ContactService** (`contact.service.ts`)
- **Responsibilities**:
  - Handles contact form submissions
  - Form validation
  - Success/error messaging

### **5. SEOService** (`seo.service.ts`)
- **Responsibilities**:
  - Dynamic meta tag management
  - Title updates per route
  - Description updates
  - Open Graph tags
  - Twitter Card tags

---

## 🎨 Design System

### **Styling Framework**
- **Tailwind CSS**: Utility-first CSS framework
- **Custom Colors**:
  - Primary: Blue shades (#1890ff to #002766)
  - Accent: Sky blue shades (#0ea5e9 to #0c4a6e)

### **Design Features**
- **Premium Containers**: Glassmorphism with gradient borders
- **Interactive Cards**: Hover effects with radial glow
- **Animated Elements**:
  - Floating animations
  - Gradient shifts
  - Shimmer effects
  - Scale transforms
  - Slide animations
- **Typography**: Gradient text effects
- **Buttons**: Animated gradients with hover states
- **Responsive Design**: Mobile-first approach

### **Animations**
- Fade in/out
- Slide up/down/left/right
- Scale in
- Floating elements
- Gradient shifts
- Pulse effects
- Shimmer effects

---

## 🔐 Security & Guards

### **AuthGuard** (`auth.guard.ts`)
- Protects dashboard route
- Redirects unauthenticated users to login
- Checks authentication status via AuthService

---

## 📱 Responsive Design

- **Mobile**: Single column layouts, hamburger menu
- **Tablet**: 2-column grids, expanded navigation
- **Desktop**: 3-4 column grids, full navigation bar

---

## 🚀 Technology Stack

- **Framework**: Angular 17+ (Standalone Components)
- **Styling**: Tailwind CSS 3.3+
- **Language**: TypeScript 5.2+
- **State Management**: Angular Signals
- **Forms**: Reactive Forms
- **Routing**: Angular Router
- **Storage**: localStorage (for demo purposes)

---

## 📊 Data Flow

1. **User Registration/Login** → AuthService → localStorage
2. **Level Finder** → Form → LevelFinderService → Result Display
3. **Contact Form** → ContactService → Success Message
4. **Dashboard** → AuthService → Child Data → Progress Tracking
5. **SEO** → SEOService → Dynamic Meta Tags

---

## 🎯 Key Features Summary

✅ **11 Pages** (10 public + 1 protected)  
✅ **5 Services** for business logic  
✅ **1 Route Guard** for authentication  
✅ **1 Custom Pipe** for safe URL rendering  
✅ **2 Shared Components** (Header & Footer)  
✅ **Premium Design System** with animations  
✅ **Fully Responsive** layout  
✅ **Form Validation** throughout  
✅ **SEO Optimization** with dynamic meta tags  
✅ **Interactive Elements** with hover effects  
✅ **PDF Viewing** capability for certificates  
✅ **Progress Tracking** for children  
✅ **Level Finder Algorithm** with complex logic  

---

## 📝 Notes

- All authentication uses localStorage (demo implementation)
- PDF certificates require actual PDF files in `/assets/certificates/`
- Gallery images are placeholders (can be replaced with actual images)
- Google Maps embeds use sample coordinates
- All forms include client-side validation
- The website is production-ready but uses mock data for some features
