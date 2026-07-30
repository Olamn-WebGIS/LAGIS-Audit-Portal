module.exports = async (req, res) => {
  const config = {
    SHEETDB_URL: process.env.SHEETDB_URL || '',
    CLOUD_NAME: process.env.CLOUD_NAME || '',
    UPLOAD_PRESET: process.env.UPLOAD_PRESET || '',
  };
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify(config));
};
