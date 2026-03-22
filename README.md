# Feature Flags & Remote Config

This project is a backend system developed for managing feature flags and remote configuration values.

It is designed to help applications enable or disable features dynamically without requiring a new deployment.

## Technologies Used

- Python
- FastAPI
- SQLModel
- MySQL / MariaDB
- Redis
- Docker
- Docker Compose
- React
- JavaScript

## Features

- Feature flag management
- Remote config management
- Admin-side CRUD operations
- API-based access for clients
- Environment-based configuration
- Containerized development setup

## Project Purpose

The main goal of this project is to provide a flexible backend structure for controlling application behavior remotely.

With this system, administrators can manage feature flags and configuration values, while client applications can fetch updated values through API endpoints.

## Getting Started

### Clone the repository

```bash
git clone https://github.com/hakangunesdev/feature-flags.git
cd feature-flags
```

### Run with Docker Compose

```bash
docker compose up --build
```

## Future Improvements

- Role-based authorization
- Audit logs
- Percentage-based rollout
- Environment-specific flag control
- Expanded admin panel features

## Notes

This project was developed for learning and portfolio purposes.
