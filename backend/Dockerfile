# Multi-stage build for the Kotlin/Quarkus backend.
# Build context is the repository root (see docker-compose.yml): context: ., dockerfile: backend/Dockerfile

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /project
COPY backend/pom.xml ./pom.xml
COPY backend/src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup -S quarkus && adduser -S quarkus -G quarkus
WORKDIR /deployments
COPY --from=build /project/target/quarkus-app/lib/ ./lib/
COPY --from=build /project/target/quarkus-app/*.jar ./
COPY --from=build /project/target/quarkus-app/app/ ./app/
COPY --from=build /project/target/quarkus-app/quarkus/ ./quarkus/
USER quarkus
EXPOSE 4000
ENV JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health >/dev/null || exit 1
CMD ["java", "-jar", "quarkus-run.jar"]
