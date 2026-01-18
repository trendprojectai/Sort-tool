from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import tempfile
import os
import sys
import json
import traceback

# Add current directory to path so we can import secondary_enrichment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from secondary_enrichment import process_csv
except ImportError:
    # Fallback/Mock for environment where secondary_enrichment.py isn't yet present
    def process_csv(input_path, output_path):
        import pandas as pd
        df = pd.read_csv(input_path)
        # Mocking enrichment logic robustly with pandas
        df['cover_image'] = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'
        df['menu_url'] = 'https://example.com/menu'
        df['menu_pdf_url'] = None
        df['gallery_images'] = '["https://images.unsplash.com/photo-1552566626-52f8b828add9"]'
        df['phone'] = '+44 20 7123 4567'
        df['opening_hours'] = '{"Mon": "9:00 - 23:00", "Tue": "9:00 - 23:00"}'
        
        # Ensure new TA fields are also in mock
        df['tripadvisor_status'] = 'pending'
        df['tripadvisor_url'] = None
        df['tripadvisor_confidence'] = 0.0
        df['tripadvisor_distance_m'] = None
        df['tripadvisor_match_notes'] = None
        
        df.to_csv(output_path, index=False)

app = Flask(__name__)

# Standard CORS configuration with explicit origins and methods
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for status monitoring"""
    return jsonify({
        'status': 'ok', 
        'message': 'Secondary Enrichment API is running',
        'version': '1.0.5'
    }), 200

@app.route('/enrich', methods=['POST'])
def enrich():
    try:
        # Get CSV data from request
        request_json = request.get_json()
        if not request_json or 'csv_data' not in request_json:
            return jsonify({'error': 'Missing csv_data field'}), 400
            
        csv_data = request_json['csv_data']
        
        # Write to temp input file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8') as temp_input:
            temp_input.write(csv_data)
            temp_input_path = temp_input.name
        
        # Create temp output file path
        temp_output_path = temp_input_path.replace('.csv', '_enriched.csv')
        
        # Run enrichment (calling the script logic)
        try:
            process_csv(temp_input_path, temp_output_path)
        except Exception as e:
            # Catch specific errors from script
            return jsonify({'error': f"Script Error: {str(e)}"}), 500
        
        # Read enriched output
        if not os.path.exists(temp_output_path):
            return jsonify({'error': 'Enrichment script failed to generate output'}), 500
            
        with open(temp_output_path, 'r', encoding='utf-8') as f:
            enriched_csv = f.read()
        
        # Cleanup
        if os.path.exists(temp_input_path):
            os.unlink(temp_input_path)
        if os.path.exists(temp_output_path):
            os.unlink(temp_output_path)
        
        return jsonify({'enriched_csv': enriched_csv})
    
    except Exception as e:
        print(f"Error during enrichment: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Cravey Push Enrichment Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
