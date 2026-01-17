const API_URL = 'https://restaurant-enrichment-api-production.up.railway.app';

class PythonServerManager {
  async checkServerHealth(): Promise<boolean> {
    const healthUrl = `${API_URL}/health`;
    console.log(`🔗 Checking API health at: ${healthUrl}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      console.log(`✅ Health check status: ${response.status}`);
      return response.ok;
    } catch (error: any) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  async enrichRestaurants(csvData: string): Promise<string> {
    const enrichUrl = `${API_URL}/enrich`;
    console.log('🔗 Calling:', enrichUrl);
    console.log('📦 Sending data length:', csvData.length);
    
    // Increased timeout to 5 minutes for long-running batch processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 seconds

    try {
      const response = await fetch(enrichUrl, {
        method: 'POST',
        mode: 'cors', // Explicitly set CORS mode
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ csv_data: csvData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('✅ Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error (${response.status}):`, errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result.enriched_csv;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('❌ Fetch error:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Cloud enrichment timed out (5 minute limit). Try processing in smaller batches.');
      }
      
      // Handle the "Failed to fetch" generic error which usually implies CORS or server down
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot reach Railway API. Check if the service is running and CORS is configured.');
      }
      
      throw error;
    }
  }
}

export const pythonServerManager = new PythonServerManager();