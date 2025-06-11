import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  CssBaseline,
  Box,
  ThemeProvider,
} from "@mui/material";
import { theme } from "./theme";
import BusinessIdeaForm from "./components/forms/BusinessIdeaForm";
import ResultsPage from "./pages/ResultsPage";
import AnalysisLoadingState from "./components/results/AnalysisLoadingState";
import { analyzeBusinessIdea } from "./services/api";

const App = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (businessIdea) => {
    setLoading(true);
    setError(null);
    try {
      const analysisResults = await analyzeBusinessIdea(businessIdea);
      setResults(analysisResults);
    } catch (err) {
      setError(err.message || "An error occurred during analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Investment Due Diligence Tool</Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          {!results && !loading && <BusinessIdeaForm onSubmit={handleSubmit} />}
          {loading && <AnalysisLoadingState />}
          {results && <ResultsPage results={results} />}
          {error && (
            <Typography color="error" align="center" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App;
