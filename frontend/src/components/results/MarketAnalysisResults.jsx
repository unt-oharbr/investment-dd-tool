import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Divider,
} from "@mui/material";

const MarketAnalysisResults = ({ analysis }) => {
  if (!analysis) return null;

  const { score, breakdown, reasoning, details } = analysis;

  return (
    <Card sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Market Analysis Results
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
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              TAM Score
            </Typography>
            <Typography variant="h6">{breakdown.tam}</Typography>
            <Typography variant="caption" color="text.secondary">
              ${details.tam.value.toFixed(2)}M
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              SAM Score
            </Typography>
            <Typography variant="h6">{breakdown.sam}</Typography>
            <Typography variant="caption" color="text.secondary">
              ${details.sam.value.toFixed(2)}M
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              SOM Score
            </Typography>
            <Typography variant="h6">{breakdown.som}</Typography>
            <Typography variant="caption" color="text.secondary">
              ${details.som.value.toFixed(2)}M
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Growth Score
            </Typography>
            <Typography variant="h6">{breakdown.growth}</Typography>
            <Typography variant="caption" color="text.secondary">
              {(details.growth.value * 100).toFixed(1)}%
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Analysis Details
          </Typography>
          <Typography variant="body1">{reasoning}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MarketAnalysisResults;
