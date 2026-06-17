# ADR-001: Use RESTful APIs for Internal Service Communication

**Status:** Accepted

**Context:**
Our system is being designed with a Microservices architecture. We need a standardized, well-understood mechanism for synchronous communication between services. The development team has experience with both RESTful APIs (using HTTP/JSON) and gRPC.

**Decision:**
We will use RESTful APIs with JSON payloads as the primary mechanism for synchronous, request-response communication between our internal microservices. All services must expose their capabilities through a well-defined OpenAPI (Swagger) specification.

**Consequences:**
*   **Positive:**
    *   Leverages existing team skills in HTTP and JSON, reducing the learning curve.
    *   Easy to debug and test using common tools like Postman, Insomnia, or even a web browser.
    *   A wide range of libraries and frameworks support REST, making implementation straightforward.
    *   The OpenAPI specification will serve as a form of "enforceable contract" between services.
*   **Negative:**
    *   REST over HTTP/JSON is more verbose and may have slightly higher latency compared to binary protocols like gRPC.
    *   We lose the benefits of strong typing across service boundaries that gRPC provides.
    *   We will need to implement our own mechanisms for features like service discovery and client-side load balancing.```

