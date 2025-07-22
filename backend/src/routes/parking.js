const express = require("express");
const router = express.Router();
const parkingController = require("../controllers/parkingController");

/**
 * Parking routes
 */

// Get all parking data
router.get("/all", parkingController.getAllParking);

// Get available parking spots
router.get("/available", parkingController.getAvailable);

// Get parking spots near a location
router.get("/nearby", parkingController.getNearby);

// Get parking statistics
router.get("/stats", parkingController.getStatistics);

// Get parking in a specific area
router.get("/area/:areaName", parkingController.getByArea);

// Get specific parking bay information
router.get("/bay/:bayId", parkingController.getBayInfo);

module.exports = router;
