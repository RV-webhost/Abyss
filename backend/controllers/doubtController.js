// Controls Doubt & AI Logic
exports.askDoubt = (req, res) => {
    res.status(200).json({ message: "Doubt Asking Route Connected" });
};

exports.getDoubtHistory = (req, res) => {
    res.status(200).json({ message: "Doubt History Route Connected" });
};