import React from "react";
import { Box, Typography, Container, Paper } from "@mui/material";
import ProblemDefinitionResults from "../components/results/ProblemDefinitionResults";
import MarketAnalysisResults from "../components/results/MarketAnalysisResults";

const ResultsPage = ({ results }) => {
  if (!results) return null;

  const { problemDefinition, marketAnalysis, combinedScore } = results;

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Analysis Results
        </Typography>

        <Paper sx={{ p: 3, mb: 4, textAlign: "center" }}>
          <Typography variant="h5" gutterBottom>
            Preliminary PMF Score
          </Typography>
          <Typography variant="h3" color="primary">
            {combinedScore}/10
          </Typography>
        </Paper>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ProblemDefinitionResults analysis={problemDefinition} />
          <MarketAnalysisResults analysis={marketAnalysis} />
        </Box>
      </Box>
    </Container>
  );
};

export default ResultsPage;
