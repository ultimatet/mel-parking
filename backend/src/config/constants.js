module.exports = {
    // Scraping configuration
    SCRAPE_URL:
        "https://data.melbourne.vic.gov.au/explore/dataset/on-street-parking-bay-sensors/table/",
    SCRAPE_INTERVAL: parseInt(2) * 60 * 1000, // Convert to milliseconds

    // Cache configuration
    CACHE_DURATION: parseInt(process.env.CACHE_DURATION || 120000), // 2 minutes default

    // API configuration
    DEFAULT_RADIUS: 500, // Default search radius in meters
    MAX_RESULTS_PER_PAGE: 50,
    DEFAULT_LIMIT: 5000,

    // Melbourne area definitions
    AREAS: {
        cbd: {
            name: "Melbourne CBD",
            bounds: {
                minLat: -37.825,
                maxLat: -37.81,
                minLon: 144.955,
                maxLon: 144.975,
            },
        },
        southbank: {
            name: "Southbank",
            bounds: {
                minLat: -37.83,
                maxLat: -37.815,
                minLon: 144.955,
                maxLon: 144.97,
            },
        },
        docklands: {
            name: "Docklands",
            bounds: {
                minLat: -37.825,
                maxLat: -37.81,
                minLon: 144.935,
                maxLon: 144.955,
            },
        },
        carlton: {
            name: "Carlton",
            bounds: {
                minLat: -37.81,
                maxLat: -37.79,
                minLon: 144.96,
                maxLon: 144.975,
            },
        },
        fitzroy: {
            name: "Fitzroy",
            bounds: {
                minLat: -37.81,
                maxLat: -37.79,
                minLon: 144.975,
                maxLon: 144.99,
            },
        },
    },

    // Parking status mappings
    PARKING_STATUS: {
        PRESENT: "Present",
        UNOCCUPIED: "Unoccupied",
    },
};
