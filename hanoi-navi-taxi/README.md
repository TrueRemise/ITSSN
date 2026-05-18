# Hanoi Navi-Taxi / ハノイ・ナビタクシー

## Quick Start

### Prerequisites
- Java 17+
- MySQL 8.0+
- Maven 3.8+

### Database Setup
```sql
CREATE DATABASE navitaxi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Run Application
```bash
# Using Maven
mvn spring-boot:run

# Or using Maven wrapper
./mvnw spring-boot:run
```

### Google Maps API Key
Google Maps is optional for booting the app, but place search and route display require a valid browser key with Maps JavaScript API, Places API, and Directions API enabled.

```bash
export GOOGLE_MAPS_API_KEY=your_valid_google_maps_browser_key
docker compose up --build
```

When the key is missing or rejected by Google, the customer screens show an in-app warning instead of loading the broken Google Maps widget.

### Access
- **Web App**: http://localhost:8080
- **Swagger API**: http://localhost:8080/swagger-ui.html
- **Default Admin**: admin@navitaxi.com / Admin@123

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/maps/route` | Calculate route |
| GET | `/api/maps/search` | Search address |
| GET | `/api/maps/fare-estimate` | Estimate fare |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/{id}` | Get booking details |

### Tech Stack
- Spring Boot 3.2.5 + Java 17
- MySQL 8 + Flyway
- Spring Security + JWT
- Thymeleaf + Google Maps API
- Swagger/OpenAPI
