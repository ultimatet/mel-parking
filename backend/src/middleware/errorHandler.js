/**
 * Global error handling middleware
 * Catches and formats all errors consistently
 */
const errorHandler = (err, req, res, next) => {
    // Log error details for debugging
    console.error("Error:", {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        body: req.body,
        query: req.query,
        params: req.params,
    });

    // Default error status code
    const statusCode = err.statusCode || 500;

    // Prepare error response
    const errorResponse = {
        success: false,
        error: {
            message: err.message || "Internal server error",
            status: statusCode,
        },
    };

    // Add additional error details in development
    if (process.env.NODE_ENV === "development") {
        errorResponse.error.stack = err.stack;
        errorResponse.error.details = err.details || null;
    }

    // Special handling for common errors
    if (err.name === "ValidationError") {
        errorResponse.error.message = "Validation error";
        errorResponse.error.fields = err.errors;
    } else if (err.name === "CastError") {
        errorResponse.error.message = "Invalid ID format";
    } else if (err.message.includes("Puppeteer")) {
        errorResponse.error.message = "Web scraping error - please try again later";
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
