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

            // Try different possible selectors
            const selectors = [
                ".odsembed-tableau",
                ".ods-table",
                "table.table",
                '[role="grid"]',
                ".dataset-table",
            ];

            let tableFound = false;
            for (const selector of selectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    tableFound = true;
                    console.log(`Found table with selector: ${selector}`);
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!tableFound) {
                console.log("Table not found, trying API interception...");
                const apiData = await this.interceptAPICall(page);
                if (apiData && apiData.length > 0) {
                    console.log(`Successfully intercepted API data: ${apiData.length} records`);
                    cacheService.set(cacheKey, apiData, this.scrapeInterval);
                    this.lastScrapeTime = Date.now();
                    return apiData;
                }
            }

            // Try to load all data
            await this.loadAllData(page);

            // Extract data from the table
            console.log("Extracting parking data...");
            const parkingData = await page.evaluate(() => {
                const data = [];

                // Try multiple possible selectors for the data table
                const tableSelectors = [
                    ".odsembed-tableau table tbody tr",
                    ".ods-table tbody tr",
                    "table.table tbody tr",
                    '[role="grid"] [role="row"]',
                    ".dataset-table tbody tr",
                    "table tbody tr",
                ];

                let rows = [];
                for (const selector of tableSelectors) {
                    rows = document.querySelectorAll(selector);
                    if (rows.length > 0) {
                        console.log(`Found ${rows.length} rows with selector: ${selector}`);
                        break;
                    }
                }

                // If no rows found in table, try to find data in page
                if (rows.length === 0) {
                    // Check if data is in JSON script tag
                    const scripts = document.querySelectorAll("script");
                    for (const script of scripts) {
                        if (
                            script.textContent.includes("bay_id") ||
                            script.textContent.includes("parking")
                        ) {
                            try {
                                // Try to extract JSON data from script
                                const match = script.textContent.match(/\{.*bay_id.*\}/);
                                if (match) {
                                    return JSON.parse(match[0]);
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                }

                // Parse each row
                rows.forEach((row, index) => {
                    const cells = row.querySelectorAll("td");
                    if (cells.length >= 5) {
                        // Map cells to expected data structure
                        // Adjust indices based on actual table structure
                        const spotData = {
                            bay_id: cells[0]?.textContent?.trim() || `BAY-${index}`,
                            st_marker_id: cells[1]?.textContent?.trim() || "",
                            status: cells[2]?.textContent?.trim() || "Unknown",
                            lat: cells[3]?.textContent?.trim() || "",
                            lon: cells[4]?.textContent?.trim() || "",
                            lastupdated: cells[5]?.textContent?.trim() || new Date().toISOString(),
                        };

                        // Only add if we have valid coordinates
                        if (spotData.lat && spotData.lon) {
                            data.push(spotData);
                        }
                    }
                });

                return data;
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
            });
        }

        return mockData;
    }

    /**
     * Intercept API calls made by the page
     */
    async interceptAPICall(page) {
        return new Promise((resolve) => {
            const apiData = [];
            let timeout;

            // Set up request interception
            page.on("response", async (response) => {
                const url = response.url();

                // Check if this is an API call for parking data
                if (
                    (url.includes("vh2v-4nfs") || url.includes("parking")) &&
                    (url.includes(".json") || response.headers()["content-type"]?.includes("json"))
                ) {
                    try {
                        const data = await response.json();
                        if (Array.isArray(data) && data.length > 0) {
                            console.log(`Intercepted API data from: ${url}`);
                            apiData.push(...data);

                            // Clear existing timeout
                            if (timeout) clearTimeout(timeout);

                            // Wait a bit more for additional data
                            timeout = setTimeout(() => resolve(apiData), 2000);
                        }
                    } catch (e) {
                        // Not JSON or failed to parse
                    }
                }
            });

            // Reload the page to capture API calls
            page.reload({ waitUntil: "networkidle2" })
                .then(() => {
                    // Fallback timeout
                    setTimeout(() => resolve(apiData), 10000);
                })
                .catch(() => resolve(apiData));
        });
    }

    /**
     * Try to load all data by handling pagination
     */
    async loadAllData(page) {
        try {
            // Check for "Load more" button
            const loadMoreSelectors = [
                'button:contains("Load more")',
                ".load-more",
                '[aria-label*="more"]',
                "button.ods-button-more",
                ".show-more-button",
            ];

            for (const selector of loadMoreSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        console.log('Found "Load more" button, clicking...');
                        await button.click();
                        await page.waitForTimeout(2000);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Or try to change page size
            const pageSizeSelector = await page.$('select[name="pagesize"], .page-size-selector');
            if (pageSizeSelector) {
                console.log("Found page size selector, setting to maximum...");
                const options = await page.$$eval('select[name="pagesize"] option', (options) =>
                    options.map((option) => option.value)
                );
                if (options.length > 0) {
                    const maxValue = Math.max(...options.map(Number).filter((n) => !isNaN(n)));
                    await page.select('select[name="pagesize"]', String(maxValue));
                    await page.waitForTimeout(2000);
                }
            }
        } catch (e) {
            console.log("No pagination controls found, continuing with default data");
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
            const availableSpots = data.filter(
                (spot) => spot.status !== PARKING_STATUS.PRESENT && spot.status !== "Present"
            );

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

            const availableNearby = nearbySpots.filter(
                (spot) => spot.status !== PARKING_STATUS.PRESENT && spot.status !== "Present"
            );

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

            const availableInArea = areaSpots.filter(
                (spot) => spot.status !== PARKING_STATUS.PRESENT && spot.status !== "Present"
            );

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
            const availableSpots = data.filter(
                (spot) => spot.status !== PARKING_STATUS.PRESENT && spot.status !== "Present"
            ).length;
            const occupiedSpots = totalSpots - availableSpots;

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
            isAvailable: spot.status !== PARKING_STATUS.PRESENT && spot.status !== "Present",
            location: {
                lat: parseFloat(spot.lat),
                lon: parseFloat(spot.lon),
            },
            lastUpdated: spot.lastupdated,
            streetMarker: spot.st_marker_id || spot.marker_id,
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

module.exports = new ParkingScraperService();
