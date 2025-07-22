const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import routes
const parkingRoutes = require("./routes/parking");
const healthRoutes = require("./routes/health");

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const logger = require("./middleware/logger");

// Create Express application
const app = express();

// Basic middleware
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(logger);

// API Routes
app.use("/api/parking", parkingRoutes);
app.use("/api/health", healthRoutes);

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        message: "Melbourne Parking API (Web Scraping)",
        version: "2.0.0",
        dataSource: "web-scraping",
        updateFrequency: `Every ${process.env.SCRAPE_INTERVAL_MINUTES || 2} minutes`,
        endpoints: {
            health: "/api/health",
            parking: {
                all: "/api/parking/all",
                available: "/api/parking/available",
                nearby: "/api/parking/nearby?lat=X&lon=Y&radius=Z",
                area: "/api/parking/area/:areaName",
                bay: "/api/parking/bay/:bayId",
                stats: "/api/parking/stats",
            },
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Route not found",
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
