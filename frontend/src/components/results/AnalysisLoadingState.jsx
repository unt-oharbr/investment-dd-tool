import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  CircularProgress,
} from "@mui/material";

const AnalysisLoadingState = () => {
  return (
    <Card sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 4,
          }}
        >
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Analyzing Your Business Idea
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mb: 2 }}
          >
            Our agents are working to evaluate your business idea across
            multiple dimensions. This may take a few moments...
          </Typography>
          <Box sx={{ width: "100%", mt: 2 }}>
            <LinearProgress />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AnalysisLoadingState;
