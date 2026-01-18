import pandas as pd
import json
import os

def process_csv(input_path, output_path):
    """
    Robustly processes the input CSV and adds enrichment columns.
    Using pandas prevents 'dict contains fields not in fieldnames' errors.
    """
    try:
        # 1. Read the input CSV
        df = pd.read_csv(input_path)
        
        # 2. Ensure enrichment columns exist (with default values)
        # Standard enrichment
        enrichment_cols = {
            'cover_image': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
            'menu_url': 'https://example.com/menu',
            'menu_pdf_url': None,
            'gallery_images': json.dumps(["https://images.unsplash.com/photo-1552566626-52f8b828add9", "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b"]),
            'phone': '+44 20 7123 4567',
            'opening_hours': json.dumps({"Mon": "9:00 - 23:00", "Tue": "9:00 - 23:00", "Wed": "9:00 - 23:00"})
        }
        
        # TripAdvisor Validation Columns (Backend update)
        ta_cols = {
            'tripadvisor_status': 'pending',
            'tripadvisor_url': None,
            'tripadvisor_confidence': 0.0,
            'tripadvisor_distance_m': None,
            'tripadvisor_match_notes': None
        }

        # Apply standard enrichment
        for col, val in enrichment_cols.items():
            if col not in df.columns:
                df[col] = val
                
        # Apply TA columns (ensures they are in the schema even if empty)
        for col, val in ta_cols.items():
            if col not in df.columns:
                df[col] = val

        # 3. Save to output
        df.to_csv(output_path, index=False)
        
    except Exception as e:
        # Re-raise with context for Flask to catch
        raise Exception(f"Processing failed: {str(e)}")
