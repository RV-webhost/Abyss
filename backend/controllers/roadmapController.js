// Controls Roadmap & AI Logic
exports.createRoadmap = (req, res) => {
    res.status(200).json({ message: "Roadmap Generation Route Connected" });
};

exports.getRoadmap = (req, res) => {
    res.status(200).json({ message: "Get Specific Roadmap Route Connected" });
};