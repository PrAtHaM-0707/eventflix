import { PACKAGES } from '../data/constants.js';

export const getLocations = (req, res) => {
    const locations = Object.keys(PACKAGES).map(key => ({
        id: key,
        name: key, // Or logic to format name if key is slug
        address: PACKAGES[key].address
    }));
    res.json({ success: true, locations });
};

export const getPackages = (req, res) => {
    const { location } = req.params;
    const locationData = PACKAGES[location];
  
    if (!locationData) {
      return res.status(404).json({
        success: false,
        message: 'Location not found',
        availableLocations: Object.keys(PACKAGES)
      });
    }
  
    // Convert packages object to array if needed by frontend, 
    // or keep as object (previous code sent logicData.packages which is likely object or array)
    // Checking server_backup.js: "packages: locationData.packages"
    
    res.json({
      success: true,
      location,
      contact: locationData.contact,
      address: locationData.address,
      packages: locationData.packages
    });
};
