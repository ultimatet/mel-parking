// backend/src/services/parkingScraperService.js
const puppeteer = require("puppeteer");
const cacheService = require("./cacheService");
const { SCRAPE_URL, SCRAPE_INTERVAL, PARKING_STATUS, AREAS } = require("../config/constants");

class ParkingScraperService {
    constructor() {
        // Use the SCRAPE_URL from constants.js
        this.baseUrl = SCRAPE_URL;
        this.browser = null;
        this.isInitialized = false;
        this.lastScrapeTime = null;
        this.scrapeInterval = SCRAPE_INTERVAL;
    }

    /**
     * Initialize the browser instance
     */
    async initBrowser() {
        if (!this.browser) {
            console.log("Initializing Puppeteer browser...");
            this.browser = await puppeteer.launch({
                headless: process.env.ENABLE_HEADLESS === "false" ? false : "new",
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                ],
            });
            this.isInitialized = true;
        }
        return this.browser;
    }

    /**
     * Close the browser instance
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.isInitialized = false;
        }
    }

    /**
     * Scrape parking data from the website
     */
    async scrapeParkingData() {
        const cacheKey = "parking:scraped:all";

        // Check if we have recent data (less than 2 minutes old)
        const cachedData = cacheService.get(cacheKey);
        if (
            cachedData &&
            this.lastScrapeTime &&
            Date.now() - this.lastScrapeTime < this.scrapeInterval
        ) {
            console.log("Returning cached scraped data");
            return cachedData;
        }

        let page;
        try {
            console.log("Starting web scraping from:", this.baseUrl);
            const browser = await this.initBrowser();
            page = await browser.newPage();

            // Set viewport and user agent
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );

            // Navigate to the page
            console.log("Navigating to parking data page...");
            await page.goto(this.baseUrl, {
                waitUntil: "networkidle2",
                timeout: 30000,
            });

            // Wait for the table to load
            console.log("Waiting for data table to load...");
            await page.waitForSelector(".odswidget-table__internal-table", {
                timeout: 15000,
                visible: true,
            });

            // Wait for data rows to appear
            await page.waitForSelector(".odswidget-table__internal-table-row", {
                timeout: 10000,
            });

            // Wait a bit more for data to populate
            await new Promise((resolve) => setTimeout(resolve, 3000));

            console.log("Table loaded successfully");

            // Try to load all data
            await this.loadAllData(page);

            // Extract data from the table with correct parsing
            console.log("Extracting parking data...");
            const parkingData = await page.evaluate(() => {
                const rows = document.querySelectorAll(
                    ".odswidget-table__internal-table tbody tr.odswidget-table__internal-table-row"
                );
                const extractedData = [];

                console.log(`Found ${rows.length} data rows`);

                rows.forEach((row, index) => {
                    const cells = row.querySelectorAll("td.odswidget-table__cell");

                    if (cells.length >= 7) {
                        // Helper function to get cell text content
                        const getCellText = (cell) => {
                            // Try to get text from span with title attribute first
                            const span = cell.querySelector("span[title]");
                            if (span) {
                                return span.getAttribute("title") || span.textContent.trim();
                            }
                            // Fallback to cell text content
                            return cell.textContent.trim();
                        };

                        // Based on the actual HTML structure:
                        // Column 0: Row number (skip this)
                        // Column 1: Lastupdated
                        // Column 2: Status_Timestamp
                        // Column 3: Zone_Number
                        // Column 4: Status_Description (Present/Unoccupied)
                        // Column 5: KerbsideID
                        // Column 6: Location (lat, lon coordinates)

                        const rowNumber = getCellText(cells[0]);
                        const lastupdated = getCellText(cells[1]);
                        const statusTimestamp = getCellText(cells[2]);
                        const zoneNumber = getCellText(cells[3]);
                        const statusDescription = getCellText(cells[4]);
                        const kerbsideID = getCellText(cells[5]);
                        const locationText = getCellText(cells[6]);

                        // Parse coordinates from location string
                        let lat = "",
                            lon = "";
                        if (locationText) {
                            const coords = locationText.split(",").map((coord) => coord.trim());
                            if (coords.length >= 2) {
                                lat = coords[0];
                                lon = coords[1];
                            }
                        }

                        // Only add records with valid data
                        if (kerbsideID && statusDescription && lat && lon) {
                            extractedData.push({
                                bay_id: kerbsideID,
                                st_marker_id: kerbsideID, // Using KerbsideID as marker ID
                                status: statusDescription, // "Present" or "Unoccupied"
                                lat: lat,
                                lon: lon,
                                lastupdated: lastupdated,
                                status_timestamp: statusTimestamp,
                                zone_number: zoneNumber,
                                row_number: rowNumber,
                            });
                        } else {
                            console.log(`Skipping row ${index + 1}: missing required data`, {
                                rowNumber,
                                kerbsideID,
                                statusDescription,
                                lat,
                                lon,
                                lastupdated,
                                statusTimestamp,
                            });
                        }
                    } else {
                        console.log(
                            `Row ${index + 1} has only ${cells.length} cells, expected at least 7`
                        );
                    }
                });

                console.log(`Successfully extracted ${extractedData.length} parking records`);
                return extractedData;
            });

            console.log(`Scraped ${parkingData.length} parking records`);

            // If no data scraped, generate mock data for testing
            if (!parkingData || parkingData.length === 0) {
                console.log("No data scraped, using mock data for testing");
                const mockData = this.generateMockData();
                cacheService.set(cacheKey, mockData, this.scrapeInterval);
                this.lastScrapeTime = Date.now();
                return mockData;
            }

            // Cache the data
            cacheService.set(cacheKey, parkingData, this.scrapeInterval);
            this.lastScrapeTime = Date.now();

            return parkingData;
        } catch (error) {
            console.error("Scraping error:", error);

            // Return mock data on error for development
            const mockData = this.generateMockData();
            cacheService.set(cacheKey, mockData, this.scrapeInterval);
            this.lastScrapeTime = Date.now();
            return mockData;
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Generate mock data for testing/development
     */
    generateMockData() {
        const mockData = [];
        const statuses = ["Present", "Unoccupied"];

        // Generate 100 mock parking spots
        for (let i = 1; i <= 100; i++) {
            mockData.push({
                bay_id: `MOCK-${String(i).padStart(3, "0")}`,
                st_marker_id: `M${Math.floor(i / 10)}-${String(i % 10).padStart(3, "0")}`,
                status: statuses[Math.random() > 0.7 ? 0 : 1], // 70% available
                lat: String(-37.8136 + (Math.random() - 0.5) * 0.02),
                lon: String(144.9631 + (Math.random() - 0.5) * 0.02),
                lastupdated: new Date(Date.now() - Math.random() * 3600000).toISOString(),
                zone_number: `708${Math.floor(Math.random() * 10)}`,
                status_timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            });
        }

        return mockData;
    }

    /**
     * Try to load all data by handling pagination or infinite scroll
     */
    async loadAllData(page) {
        try {
            console.log("Checking for pagination/infinite scroll...");

            // Check initial row count
            let previousCount = await page.evaluate(() => {
                return document.querySelectorAll(".odswidget-table__internal-table-row").length;
            });

            console.log(`Initial row count: ${previousCount}`);

            // Try scrolling to load more data
            let attempts = 0;
            const maxAttempts = 15; // Increased attempts to get more data

            while (attempts < maxAttempts) {
                // Scroll to bottom of the table container
                await page.evaluate(() => {
                    const tableContainer = document.querySelector(".odswidget-table__records");
                    if (tableContainer) {
                        tableContainer.scrollTop = tableContainer.scrollHeight;
                    }
                    // Also scroll the page
                    window.scrollTo(0, document.body.scrollHeight);
                });

                // Wait for potential new data to load
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Check if new rows were loaded
                const currentCount = await page.evaluate(() => {
                    return document.querySelectorAll(".odswidget-table__internal-table-row").length;
                });

                console.log(`Scroll attempt ${attempts + 1}: ${currentCount} rows loaded`);

                // If no new rows were loaded, we've reached the end
                if (currentCount === previousCount) {
                    // Try one more aggressive scroll
                    await page.evaluate(() => {
                        // Trigger scroll events
                        const tableContainer = document.querySelector(".odswidget-table__records");
                        if (tableContainer) {
                            const event = new Event("scroll", { bubbles: true });
                            tableContainer.dispatchEvent(event);
                        }
                    });

                    await new Promise((resolve) => setTimeout(resolve, 3000));

                    const finalCount = await page.evaluate(() => {
                        return document.querySelectorAll(".odswidget-table__internal-table-row")
                            .length;
                    });

                    if (finalCount === currentCount) {
                        console.log(
                            "No new rows loaded after aggressive scroll, stopping attempts"
                        );
                        break;
                    } else {
                        currentCount = finalCount;
                    }
                }

                previousCount = currentCount;
                attempts++;
            }

            console.log(`Final row count after scrolling: ${previousCount}`);
        } catch (e) {
            console.log("Error during pagination:", e.message);
        }
    }

    /**
     * Get all parking data
     */
    async getAllParkingData() {
        try {
            const data = await this.scrapeParkingData();
            return { data, cached: false };
        } catch (error) {
            console.error("Error in getAllParkingData:", error);
            throw error;
        }
    }

    /**
     * Get available parking spots
     */
    async getAvailableSpots() {
        try {
            const data = await this.scrapeParkingData();
            const availableSpots = data.filter((spot) => spot.status === "Unoccupied");

            return {
                total: availableSpots.length,
                spots: this.transformSpotData(availableSpots),
            };
        } catch (error) {
            console.error("Error in getAvailableSpots:", error);
            throw error;
        }
    }

    /**
     * Get parking spots near a location
     */
    async getNearbySpots(lat, lon, radius) {
        try {
            const data = await this.scrapeParkingData();

            const nearbySpots = data.filter((spot) => {
                const spotLat = parseFloat(spot.lat);
                const spotLon = parseFloat(spot.lon);
                const distance = this.calculateDistance(lat, lon, spotLat, spotLon);
                return distance <= radius;
            });

            const availableNearby = nearbySpots.filter((spot) => spot.status === "Unoccupied");

            return {
                total: nearbySpots.length,
                available: availableNearby.length,
                radius: parseInt(radius),
                center: { lat: parseFloat(lat), lon: parseFloat(lon) },
                spots: this.transformSpotData(nearbySpots),
            };
        } catch (error) {
            console.error("Error in getNearbySpots:", error);
            throw error;
        }
    }

    /**
     * Get parking spots in a specific area
     */
    async getAreaSpots(areaBounds) {
        try {
            const data = await this.scrapeParkingData();
            const { minLat, maxLat, minLon, maxLon } = areaBounds;

            const areaSpots = data.filter((spot) => {
                const lat = parseFloat(spot.lat);
                const lon = parseFloat(spot.lon);
                return lat > minLat && lat < maxLat && lon > minLon && lon < maxLon;
            });

            const availableInArea = areaSpots.filter((spot) => spot.status === "Unoccupied");

            return {
                bounds: areaBounds,
                total: areaSpots.length,
                available: availableInArea.length,
                spots: this.transformSpotData(areaSpots),
            };
        } catch (error) {
            console.error("Error in getAreaSpots:", error);
            throw error;
        }
    }

    /**
     * Get specific bay information
     */
    async getBayInfo(bayId) {
        try {
            const data = await this.scrapeParkingData();
            const spot = data.find((s) => s.bay_id === bayId);

            if (!spot) {
                return null;
            }

            return this.transformSingleSpot(spot);
        } catch (error) {
            console.error("Error in getBayInfo:", error);
            throw error;
        }
    }

    /**
     * Get parking statistics
     */
    async getStatistics() {
        try {
            const data = await this.scrapeParkingData();

            const totalSpots = data.length;
            const availableSpots = data.filter((spot) => spot.status === "Unoccupied").length;
            const occupiedSpots = data.filter((spot) => spot.status === "Present").length;

            return {
                total: totalSpots,
                available: availableSpots,
                occupied: occupiedSpots,
                occupancyRate:
                    totalSpots > 0 ? ((occupiedSpots / totalSpots) * 100).toFixed(2) + "%" : "0%",
                lastUpdated: new Date().toISOString(),
                dataSource: "web-scraping",
            };
        } catch (error) {
            console.error("Error in getStatistics:", error);
            throw error;
        }
    }

    /**
     * Calculate distance between two points
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Transform spot data
     */
    transformSpotData(spots) {
        return spots.map((spot) => this.transformSingleSpot(spot));
    }

    /**
     * Transform single spot
     */
    transformSingleSpot(spot) {
        return {
            bayId: spot.bay_id,
            status: spot.status,
            isAvailable: spot.status === "Unoccupied",
            location: {
                lat: parseFloat(spot.lat),
                lon: parseFloat(spot.lon),
            },
            lastUpdated: spot.lastupdated,
            streetMarker: spot.st_marker_id,
            zoneNumber: spot.zone_number,
            statusTimestamp: spot.status_timestamp,
        };
    }

    /**
     * Cleanup method - call on app shutdown
     */
    async cleanup() {
        console.log("Cleaning up Puppeteer browser...");
        await this.closeBrowser();
    }
}

// IMPORTANT: Export a new instance of the class
module.exports = new ParkingScraperService();
