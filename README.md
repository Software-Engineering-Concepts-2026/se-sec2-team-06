# Project: [ชื่อโปรเจกต์ของคุณ]
_A brief, one-sentence description of what your project does._

## Team: [ชื่อทีมของคุณ]
- [ชื่อ-นามสกุล], GitHub: `[github_username]`
- [ชื่อ-นามสกุล], GitHub: `[github_username]`
- [ชื่อ-นามสกุล], GitHub: `[github_username]`

---

## 🚀 Getting Started

This section explains how to get a local copy of the project up and running for development and testing purposes.

### Prerequisites

- Git
- Python 3.10+
- Docker & Docker Compose

### Running the Application (with Docker)

1.  **Clone the repository:**
    ```bash
    git clone [your-repository-url]
    cd [your-project-folder]
    ```

2.  **Run the services:**
    *(This section will be updated in later weeks when using Docker Compose)*
    ```bash
    # Example for a single service
    cd services/stats-service
    docker build -t your-team/stats-service .
    docker run -p 5001:5000 your-team/stats-service
    ```

---

## 🏛️ Architecture & Design

Key architectural decisions and diagrams are documented in the `/docs/architecture` directory.

- **[C4 Models & Tech Stack](./docs/architecture/README.md)**
- **[Architectural Decision Records (ADRs)](./docs/architecture/adr/)**

## 👥 Requirements

User personas and key scenarios that drive our development are located in the `/docs/requirements` directory.

- **[User Personas](./docs/requirements/personas/)**
- **[Main User Scenario](./docs/requirements/main_scenario.md)**
