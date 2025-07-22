/**
 * Request logging middleware
 * Logs all incoming requests with timing information
 */
const logger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log request
    console.log(`[${timestamp}] ${req.method} ${req.path}`);

    // Log query parameters if any
    if (Object.keys(req.query).length > 0) {
        console.log(`  Query:`, req.query);
    }

    // Log response when finished
    res.on("finish", () => {
        const duration = Date.now() - start;
        const timestamp = new Date().toISOString();

        // Color code based on status
        let statusColor = "\x1b[32m"; // green
        if (res.statusCode >= 400) statusColor = "\x1b[31m"; // red
        else if (res.statusCode >= 300) statusColor = "\x1b[33m"; // yellow

        console.log(
            `[${timestamp}] ${req.method} ${req.path} - ${statusColor}${res.statusCode}\x1b[0m (${duration}ms)`
        );
    });

    next();
};

module.exports = logger;
