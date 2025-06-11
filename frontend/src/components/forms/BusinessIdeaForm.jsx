import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { analyzeBusinessIdea } from "../../services/api";

const BusinessIdeaForm = ({ onAnalysisComplete }) => {
  const [formData, setFormData] = useState({
    businessIdea: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await analyzeBusinessIdea(formData.businessIdea);
      onAnalysisComplete(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ maxWidth: 600, mx: "auto", p: 3 }}
    >
      <Typography variant="h5" gutterBottom>
        Analyze Business Idea
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        required
        label="Business Idea"
        name="businessIdea"
        value={formData.businessIdea}
        onChange={handleChange}
        margin="normal"
        multiline
        rows={4}
        placeholder="Describe your business idea..."
        disabled={loading}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading || !formData.businessIdea.trim()}
        sx={{ mt: 2 }}
      >
        {loading ? <CircularProgress size={24} /> : "Analyze"}
      </Button>
    </Box>
  );
};

export default BusinessIdeaForm;
