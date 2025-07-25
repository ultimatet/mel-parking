// backend/test-scraper.js
require("dotenv").config();
const parkingScraperService = require("./src/services/parkingScraperService");

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[36m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
};

function log(message, color = "reset") {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testScraper() {
    log("\n========== MELBOURNE PARKING SCRAPER TEST ==========\n", "bright");

    try {
        // Test 1: Basic scraping
        log("TEST 1: Scraping parking data...", "yellow");
        const startTime = Date.now();

        const allData = await parkingScraperService.scrapeParkingData();
        const scrapeDuration = Date.now() - startTime;

        log(`✅ Scraping completed in ${scrapeDuration}ms`, "green");
        log(`📊 Total records scraped: ${allData.length}`, "blue");

        if (allData.length > 0) {
            // Show first 3 records
            log("\n📋 Sample data (first 3 records):", "yellow");
            allData.slice(0, 3).forEach((spot, index) => {
                console.log(`\n  Record ${index + 1}:`);
                console.log(`    Bay ID: ${colors.bright}${spot.bay_id}${colors.reset}`);
                console.log(
                    `    Status: ${spot.status === "Present" ? colors.red : colors.green}${
                        spot.status
                    }${colors.reset}`
                );
                console.log(`    Marker: ${spot.st_marker_id}`);
                console.log(`    Location: ${spot.lat}, ${spot.lon}`);
                console.log(`    Last Updated: ${spot.lastupdated}`);
            });

            // Test 2: Statistics
            log("\n\nTEST 2: Getting parking statistics...", "yellow");
            const stats = await parkingScraperService.getStatistics();

            log("\n📊 Parking Statistics:", "blue");
            console.log(`    Total Spots: ${colors.bright}${stats.total}${colors.reset}`);
            console.log(`    Available: ${colors.green}${stats.available}${colors.reset}`);
            console.log(`    Occupied: ${colors.red}${stats.occupied}${colors.reset}`);
            console.log(
                `    Occupancy Rate: ${colors.magenta}${stats.occupancyRate}${colors.reset}`
            );
            console.log(`    Data Source: ${stats.dataSource}`);

            // Test 3: Available spots
            log("\n\nTEST 3: Getting available spots...", "yellow");
            const available = await parkingScraperService.getAvailableSpots();

            log(`\n✅ Found ${available.total} available parking spots`, "green");
            if (available.spots.length > 0) {
                log("\nSample available spots:", "blue");
                available.spots.slice(0, 3).forEach((spot, index) => {
                    console.log(`\n  Available Spot ${index + 1}:`);
                    console.log(`    Bay ID: ${spot.bayId}`);
                    console.log(`    Street Marker: ${spot.streetMarker}`);
                    console.log(
                        `    Location: ${spot.location.lat.toFixed(6)}, ${spot.location.lon.toFixed(
                            6
                        )}`
                    );
                });
            }

            // Test 4: Area-based search
            log("\n\nTEST 4: Testing area-based search (CBD)...", "yellow");
            const cbdBounds = {
                minLat: -37.825,
                maxLat: -37.81,
                minLon: 144.955,
                maxLon: 144.975,
            };

            const cbdSpots = await parkingScraperService.getAreaSpots(cbdBounds);
            log(`\n📍 CBD Area Results:`, "blue");
            console.log(`    Total spots in CBD: ${cbdSpots.total}`);
            console.log(`    Available in CBD: ${cbdSpots.available}`);

            // Test 5: Nearby search
            log("\n\nTEST 5: Testing nearby search...", "yellow");
            const melbourneCentralLat = -37.8136;
            const melbourneCentralLon = 144.9631;
            const radius = 500; // 500 meters

            const nearbySpots = await parkingScraperService.getNearbySpots(
                melbourneCentralLat,
                melbourneCentralLon,
                radius
            );

            log(`\n📍 Nearby Search Results (Melbourne Central, ${radius}m radius):`, "blue");
            console.log(`    Total spots nearby: ${nearbySpots.total}`);
            console.log(`    Available nearby: ${nearbySpots.available}`);

            // Data validation
            log("\n\nDATA VALIDATION:", "yellow");
            const validationResults = validateData(allData);

            Object.entries(validationResults).forEach(([key, value]) => {
                const icon = value.valid ? "✅" : "❌";
                const color = value.valid ? "green" : "red";
                log(`${icon} ${key}: ${value.message}`, color);
            });
        } else {
            log("\n⚠️  No data was scraped. This could mean:", "red");
            console.log("   - The website structure has changed");
            console.log("   - The page is loading slowly");
            console.log("   - There's a network issue");
            console.log("   - The scraper needs to be updated");
        }
    } catch (error) {
        log(`\n❌ Error during scraping: ${error.message}`, "red");
        console.error("Full error:", error);
    } finally {
        // Cleanup
        log("\n\nCleaning up...", "yellow");
        await parkingScraperService.cleanup();
        log("✅ Cleanup completed", "green");

        log("\n========== TEST COMPLETED ==========\n", "bright");
        process.exit(0);
    }
}

// Validate scraped data
function validateData(data) {
    const results = {};

    // Check if data is array
    results.dataType = {
        valid: Array.isArray(data),
        message: Array.isArray(data) ? "Data is an array" : "Data is not an array",
    };

    if (!Array.isArray(data) || data.length === 0) {
        return results;
    }

    // Check required fields
    const requiredFields = ["bay_id", "status", "lat", "lon"];
    const sampleRecord = data[0];

    requiredFields.forEach((field) => {
        const hasField = sampleRecord.hasOwnProperty(field);
        results[`field_${field}`] = {
            valid: hasField,
            message: hasField ? `Has ${field} field` : `Missing ${field} field`,
        };
    });

    // Check coordinate validity
    const invalidCoords = data.filter((spot) => {
        const lat = parseFloat(spot.lat);
        const lon = parseFloat(spot.lon);
        return isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0;
    });

    results.coordinates = {
        valid: invalidCoords.length === 0,
        message:
            invalidCoords.length === 0
                ? "All coordinates are valid"
                : `${invalidCoords.length} records have invalid coordinates`,
    };

    // Check status values
    const statusValues = [...new Set(data.map((spot) => spot.status))];
    results.statusValues = {
        valid: true,
        message: `Status values found: ${statusValues.join(", ")}`,
    };

    return results;
}

// Run the test
testScraper();

// backend/test-scraper-visual.js
// Visual/debug version that shows the browser
require("dotenv").config();

// Temporarily set headless to false to see what's happening
process.env.ENABLE_HEADLESS = "false";

const puppeteer = require("puppeteer");
const { SCRAPE_URL } = require("./src/config/constants");

async function visualScrapeTest() {
    console.log("\n🔍 VISUAL SCRAPING TEST - Browser will open\n");

    let browser;
    let page;

    try {
        // Launch browser in non-headless mode
        browser = await puppeteer.launch({
            headless: false,
            devtools: true, // Opens Chrome DevTools automatically
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
        });

        page = await browser.newPage();

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`📍 Navigating to: ${SCRAPE_URL}`);

        // Navigate to the page
        await page.goto(SCRAPE_URL, {
            waitUntil: "networkidle2",
            timeout: 30000,
        });

        console.log("✅ Page loaded. Browser is open for inspection.");
        console.log("\n📋 Instructions:");
        console.log("1. Check if the table is visible");
        console.log("2. Open Chrome DevTools (F12) to inspect elements");
        console.log("3. Try these in the Console:");
        console.log('   - document.querySelectorAll("table")');
        console.log('   - document.querySelectorAll(".ods-table")');
        console.log('   - document.querySelectorAll("[role=grid]")');
        console.log("\n⏸️  Press Enter to continue with automated extraction...");

        // Wait for user input
        await new Promise((resolve) => {
            process.stdin.once("data", resolve);
        });

        // Try to extract data
        console.log("\n🔄 Attempting to extract data...");

        const data = await page.evaluate(() => {
            const results = {
                tables: document.querySelectorAll("table").length,
                possibleSelectors: [],
            };

            // Check various selectors
            const selectors = [
                "table",
                ".ods-table",
                ".dataset-table",
                '[role="grid"]',
                ".tableau-table",
                "iframe",
            ];

            selectors.forEach((selector) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    results.possibleSelectors.push({
                        selector,
                        count: elements.length,
                    });
                }
            });

            // Try to get actual data
            const rows = document.querySelectorAll("table tbody tr, .ods-table tbody tr");
            results.rowCount = rows.length;

            // Get sample row data
            if (rows.length > 0) {
                const firstRow = rows[0];
                const cells = firstRow.querySelectorAll("td");
                results.sampleRow = Array.from(cells).map((cell) => cell.textContent.trim());
            }

            return results;
        });

        console.log("\n📊 Extraction Results:");
        console.log(JSON.stringify(data, null, 2));

        console.log("\n⏸️  Press Enter to close browser...");
        await new Promise((resolve) => {
            process.stdin.once("data", resolve);
        });
    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
        process.exit(0);
    }
}

// Uncomment to run visual test
// visualScrapeTest();
