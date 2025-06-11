import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
} from "@mui/material";

const AnalysisResults = ({ analysis }) => {
  if (!analysis) return null;

  const { score, breakdown, confidence, reasoning } = analysis;

  return (
    <Card sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Analysis Results
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Overall Score: {score}/10
          </Typography>
          <LinearProgress
            variant="determinate"
            value={score * 10}
            sx={{ height: 10, borderRadius: 5 }}
          />
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Object.entries(breakdown).map(([key, value]) => (
            <Grid item xs={6} sm={3} key={key}>
              <Typography variant="subtitle2" color="text.secondary">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Typography variant="h6">{value}</Typography>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Confidence
          </Typography>
          <Typography variant="body1">{confidence * 100}%</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Reasoning
          </Typography>
          <Typography variant="body1">{reasoning}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AnalysisResults;
