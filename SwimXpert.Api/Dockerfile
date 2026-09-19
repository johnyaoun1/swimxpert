# ASP.NET Core API — Railway service "api"
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY SwimXpert.Api/SwimXpert.Api.csproj SwimXpert.Api/
RUN dotnet restore SwimXpert.Api/SwimXpert.Api.csproj
COPY SwimXpert.Api/ SwimXpert.Api/
RUN dotnet publish SwimXpert.Api/SwimXpert.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
# Railway sets PORT at runtime
CMD ["sh", "-c", "export ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} && exec dotnet SwimXpert.Api.dll"]
