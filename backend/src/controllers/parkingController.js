const parkingScraperService = require("../services/parkingScraperService");
const { AREAS, DEFAULT_RADIUS } = require("../config/constants");

/**
 * Parking controller handles all parking-related HTTP requests
 */
class ParkingController {
    /**
     * Get all parking data
     * GET /api/parking/all
     */
    async getAllParking(req, res, next) {
        try {
            const result = await parkingScraperService.getAllParkingData();
            res.json({
                success: true,
                source: "web-scraping",
                count: result.data.length,
                lastUpdated: parkingScraperService.lastScrapeTime,
                data: result.data,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get available parking spots
     * GET /api/parking/available
     */
    async getAvailable(req, res, next) {
        try {
            const result = await parkingScraperService.getAvailableSpots();
            res.json({
                success: true,
                source: "web-scraping",
                lastUpdated: parkingScraperService.lastScrapeTime,
                ...result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get parking spots near a location
     * GET /api/parking/nearby?lat=X&lon=Y&radius=Z
     */
    async getNearby(req, res, next) {
        try {
            const { lat, lon, radius = DEFAULT_RADIUS } = req.query;

            if (!lat || !lon) {
                return res.status(400).json({
                    success: false,
                    error: "Latitude and longitude are required",
                });
            }

            const latitude = parseFloat(lat);
            const longitude = parseFloat(lon);
            const searchRadius = parseInt(radius);

            if (isNaN(latitude) || isNaN(longitude)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid latitude or longitude",
                });
            }

            if (searchRadius > 5000) {
                return res.status(400).json({
                    success: false,
                    error: "Radius cannot exceed 5000 meters",
                });
            }

            const result = await parkingScraperService.getNearbySpots(
                latitude,
                longitude,
                searchRadius
            );
            res.json({
                success: true,
                source: "web-scraping",
                lastUpdated: parkingScraperService.lastScrapeTime,
                ...result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get parking in a specific area
     * GET /api/parking/area/:areaName
     */
    async getByArea(req, res, next) {
        try {
            const { areaName } = req.params;
            const area = AREAS[areaName.toLowerCase()];

            if (!area) {
                return res.status(404).json({
                    success: false,
                    error: "Area not found",
                    availableAreas: Object.keys(AREAS),
                });
            }

            const result = await parkingScraperService.getAreaSpots(area.bounds);
            res.json({
                success: true,
                source: "web-scraping",
                area: area.name,
                lastUpdated: parkingScraperService.lastScrapeTime,
                ...result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get specific parking bay information
     * GET /api/parking/bay/:bayId
     */
    async getBayInfo(req, res, next) {
        try {
            const { bayId } = req.params;

            if (!bayId) {
                return res.status(400).json({
                    success: false,
                    error: "Bay ID is required",
                });
            }

            const bayInfo = await parkingScraperService.getBayInfo(bayId);

            if (!bayInfo) {
                return res.status(404).json({
                    success: false,
                    error: "Bay not found",
                });
            }

            res.json({
                success: true,
                source: "web-scraping",
                lastUpdated: parkingScraperService.lastScrapeTime,
                data: bayInfo,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get parking statistics
     * GET /api/parking/stats
     */
    async getStatistics(req, res, next) {
        try {
            const stats = await parkingScraperService.getStatistics();
            res.json({
                success: true,
                source: "web-scraping",
                data: stats,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ParkingController();
