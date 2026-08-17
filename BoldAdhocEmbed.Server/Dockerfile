# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS with-node
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs


FROM with-node AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["BoldAdhocEmbed.Server/BoldAdhocEmbed.Server.csproj", "BoldAdhocEmbed.Server/"]
COPY ["boldadhocembed.client/boldadhocembed.client.esproj", "boldadhocembed.client/"]
RUN dotnet restore "./BoldAdhocEmbed.Server/BoldAdhocEmbed.Server.csproj"
COPY . .
WORKDIR "/src/boldadhocembed.client"
RUN npm install
WORKDIR "/src/BoldAdhocEmbed.Server"
RUN dotnet build "./BoldAdhocEmbed.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./BoldAdhocEmbed.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "BoldAdhocEmbed.Server.dll"]
