use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    #[allow(dead_code)]
    pub next_cursor: Option<String>,
}

pub struct ArkoraApi {
    client: Client,
    base_url: String,
    api_key: String,
}

impl ArkoraApi {
    pub fn new(base_url: &str, api_key: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<ApiResponse<T>> {
        let url = format!("{}/api/v1{}", self.base_url, path);
        let resp = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .send()
            .await?;

        let status = resp.status();
        let body = resp.text().await?;

        if status.as_u16() == 429 {
            return Err(anyhow!("Rate limited. Try again in a moment."));
        }
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(anyhow!("Authentication failed. Run `arkora login` again."));
        }

        let parsed: ApiResponse<T> =
            serde_json::from_str(&body).map_err(|e| anyhow!("Invalid response: {e}"))?;

        if !parsed.success {
            return Err(anyhow!(
                "{}",
                parsed.error.unwrap_or("Unknown error".into())
            ));
        }

        Ok(parsed)
    }

    pub async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &serde_json::Value,
    ) -> Result<ApiResponse<T>> {
        let url = format!("{}/api/v1{}", self.base_url, path);
        let resp = self
            .client
            .post(&url)
            .header("X-API-Key", &self.api_key)
            .json(body)
            .send()
            .await?;

        let status = resp.status();
        let text = resp.text().await?;

        if status.as_u16() == 429 {
            return Err(anyhow!("Rate limited. Try again in a moment."));
        }
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(anyhow!("Authentication failed. Run `arkora login` again."));
        }

        let parsed: ApiResponse<T> =
            serde_json::from_str(&text).map_err(|e| anyhow!("Invalid response: {e}"))?;

        if !parsed.success {
            return Err(anyhow!(
                "{}",
                parsed.error.unwrap_or("Unknown error".into())
            ));
        }

        Ok(parsed)
    }
}
