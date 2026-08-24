# Implement asynchronous audit log module

Create a MikroORM entity with an ID, action type, resource name, and JSON details. Add an endpoint that triggers audit logging, but ensure database insertion happens through a background queue worker. Include the required tests and migration.
