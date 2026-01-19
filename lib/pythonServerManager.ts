const API_URL = 'https://restaurant-enrichment-api-production.up.railway.app';

class PythonServerManager {
  async checkServerHealth(retries = 3): Promise<boolean> {
    const healthUrl = `${API_URL}/health`;
    console.log(`🔗 Checking API health at: ${healthUrl} (Attempt ${4 - retries}/3)`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      console.log(`✅ Health check status: ${response.status}`);
      return response.ok;
    } catch (error: any) {
      console.error(`❌ Health check attempt failed:`, error.message);
      
      if (retries > 0) {
        console.log('⏳ Retrying health check in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.checkServerHealth(retries - 1);
      }
      
      return false;
    }
  }

  async enrichRestaurants(csvData: string): Promise<string> {
    const enrichUrl = `${API_URL}/enrich`;
    console.log('🔗 Calling enrichment API:', enrichUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    try {
      const response = await fetch(enrichUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ csv_data: csvData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error (${response.status}):`, errorText);
        throw new Error(`Cloud API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result.enriched_csv;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Cloud enrichment timed out. The server took too long to respond.');
      }

      if (error.message === 'Failed to fetch') {
        console.error('❌ Network error/CORS block detected.');
        throw new Error('Connection failed. Please check if the API server is online. If you are developing locally, ensure your browser allows cross-origin requests to Railway.');
      }
      
      throw error;
    }
  }

  async createTertiarySnapshot(csvData: string): Promise<{tertiary_snapshot_id: string, row_count: number}> {
    const url = `${API_URL}/tertiary/snapshot`;
    console.log('🔗 Creating Tertiary Snapshot:', url);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_data: csvData })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Snapshot Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return {
        tertiary_snapshot_id: result.tertiary_snapshot_id,
        row_count: result.row_count || 0
      };
    } catch (error: any) {
      console.error('❌ Snapshot creation failed:', error);
      throw error;
    }
  }

  async tertiaryEnrich(snapshotId: string): Promise<any> {
    const url = `${API_URL}/tertiary/enrich`;
    console.log('🔗 Running Tertiary Enrichment:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minute timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ tertiary_snapshot_id: snapshotId }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tertiary Enrich Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Tertiary enrichment failed:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const pythonServerManager = new PythonServerManager();