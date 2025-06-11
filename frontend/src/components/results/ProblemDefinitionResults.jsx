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

const ProblemDefinitionResults = ({ analysis }) => {
  if (!analysis) return null;

  const { score, breakdown, reasoning, details } = analysis;

  return (
    <Card sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Problem Definition Analysis
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
              Problem Clarity
            </Typography>
            <Typography variant="h6">{breakdown?.clarity || 0}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Market Need
            </Typography>
            <Typography variant="h6">{breakdown?.evidence || 0}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Solution Fit
            </Typography>
            <Typography variant="h6">{breakdown?.urgency || 0}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="subtitle2" color="text.secondary">
              Competition
            </Typography>
            <Typography variant="h6">{breakdown?.frequency || 0}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Key Insights
          </Typography>
          {details?.keyInsights ? (
            details.keyInsights.map((insight, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                • {insight}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No key insights available
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Detailed Analysis
          </Typography>
          <Typography variant="body1">
            {reasoning || "No detailed analysis available"}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProblemDefinitionResults;
