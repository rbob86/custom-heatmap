import 'leaflet/dist/leaflet.css'
import './main.css'
import L from 'leaflet'
import geoData from './countries-geojson.json'
import chroma from 'chroma-js'

looker.plugins.visualizations.add({
  id: "custom_heatmap",
  label: "Custom Heatmap",
  options: {
    fill_opacity: {
      label: "Fill Opacity",
      type: "number",
      min: 0,
      max: 1,
      step: 0.1,
      default: 0.8,
      section: "Plot",
      order: 1
    },
    heatmap_gridlines: {
      label: "Heatmap Gridlines",
      type: "boolean",
      default: false,
      section: "Plot",
      order: 2
    },
    show_gridlines_on_blank_regions: {
      label: "Show Gridlines for Countries with No Data",
      section: "Plot",
      type: "boolean",
      default: false,
      order: 3
    },
    no_data_gridline_color: {
      label: "No Data Gridline Color",
      type: "string",
      default: "#ccc",
      section: "Plot",
      order: 4,
    },
    enable_zoom: {
      label: "Enable Zoom",
      type: "boolean",
      default: true,
      section: "Map",
      order: 1,
    },
    enable_pan: {
      label: "Enable Panning",
      type: "boolean",
      default: true,
      section: "Map",
      order: 2
    },
    minZoom: {
      label: "Minimum Zoom Level",
      section: "Map",
      type: "number",
      default: 2,
      order: 3,
      step: .1
    },
    maxZoom: {
      label: "Maximum Zoom Level",
      section: "Map",
      type: "number",
      default: 4,
      order: 4,
      step: .1
    },
    show_region_name_in_tooltip: {
      type: "boolean",
      label: "Show Region Name in Tooltip",
      default: true,
      section: "Map"
    },
    region_name_color_matches_heatmap: {
      type: "boolean",
      label: "Region Name Color Matches Heatmap",
      default: true,
      section: "Map"
    },
    show_full_measure_name: {
      type: "boolean",
      label: "Show Full Measure Name",
      default: false,
      section: "Map"
    },
    color_scale: {
      label: "Color Scale (comma-separated hex values)",
      type: "string",
      default: "#EB8230, #EB8C00, #FFB600",
      section: "Value"
    },
    reverse_colors: {
      type: "boolean",
      label: "Reverse Colors",
      default: false,
      section: "Value"
    },
  },

  create: function (element, config) {
    element.innerHTML = `<div id="map" style="width: 100%; height: 100%;"></div>`;

    const mapElement = document.getElementById('map')
    mapElement.style.width = '100%'
    mapElement.style.height = '100%'

    this.map = L.map("map", {
      worldCopyJump: false,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      zoomSnap: 1,
      zoomControl: config.enable_zoom
    });

    this.map.attributionControl.setPrefix('')

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      noWrap: true
    }).addTo(this.map)

    this.geojsonLayer = null
  },

  updateAsync: function (data, element, config, queryResponse, details, done) {
    // Extract Country Names from Data
    const countriesInData = new Set()
    data.forEach(row => {
      const country = row[config.query_fields.dimensions[0].name].value
      countriesInData.add(country)
    })

    console.log(data)
    console.log(queryResponse)

    // Filter GeoJSON for Relevant Countries
    const filteredGeoData = {
      type: "FeatureCollection",
      features: config.show_gridlines_on_blank_regions ? geoData.features : geoData.features.filter(feature => countriesInData.has(feature.properties.name) || countriesInData.has(feature.properties.name2))
    }

    // Data Processing
    const countryData = {}
    let minValue = Infinity
    let maxValue = -Infinity
    data.forEach(row => {
      const country = row[config.query_fields.dimensions[0].name].value
      const value = row[config.query_fields.measures[0].name].value
      countryData[country] = value
      if (value < minValue) minValue = value
      if (value > maxValue) maxValue = value
    })

    // Get colors from options and create a chroma scale
    const colorScaleString = config.color_scale || this.options.color_scale.default
    const colors = colorScaleString.split(",").map(color => color.trim())
    if (config.reverse_colors) {
      colors.reverse();
    }
    const colorScale = chroma.scale(colors).domain([minValue, maxValue])

    // Style Function
    function style(feature) {
      let value = countryData[feature.properties.name];
      if (typeof value === 'undefined') {
        value = countryData[feature.properties.name2];
      }

      const hasData = value !== undefined;

      if (hasData) {
        const baseStyle = {
          fillColor: colorScale(value).hex(),
          color: colorScale(value).hex(),
          weight: config.heatmap_gridlines ? 2 : 0,
          fillOpacity: config.fill_opacity
        };

        let tooltipContent = '';
        const tooltipRegionColor = config.region_name_color_matches_heatmap ? colorScale(value).hex() : '';
        if (config.show_region_name_in_tooltip) {
          tooltipContent += `<p class="tooltip-region" style="color: ${tooltipRegionColor}">${feature.properties.name}</p>`;
        }
        const measureLabel = config.show_full_measure_name ? config.query_fields.measures[0].label : config.query_fields.measures[0].label_short;
        tooltipContent += `<p class="tooltip-value-label">${measureLabel}</p><p class="tooltip-value">${value.toLocaleString()}</p>`;
        feature.properties.tooltipContent = tooltipContent;

        return baseStyle
      }

      if (config.show_gridlines_on_blank_regions) {
        return {
          fillColor: 'transparent',
          color: config.no_data_gridline_color ? config.no_data_gridline_color : '#ccc',
          weight: '2',
        }
      }

      return {
        fillColor: 'transparent',
        color: 'transparent',
        weight: 0
      }
    }

    // Update Zoom Controls After Data Load (in case of dynamic data changes)
    this.map.setMinZoom(config.minZoom);
    this.map.setMaxZoom(config.maxZoom);

    // Update GeoJSON Layer
    if (this.geojsonLayer) {
      this.map.removeLayer(this.geojsonLayer)
    }

    this.geojsonLayer = L.geoJson(filteredGeoData, {
      style,
      onEachFeature: (feature, layer) => {
        // Only show tooltip if exists on layer (region with data)
        if (feature.properties.tooltipContent) {
          // Create custom tooltip
          const tooltipElement = L.DomUtil.create('div', 'custom-tooltip');
          tooltipElement.innerHTML = feature.properties.tooltipContent;
          document.body.appendChild(tooltipElement);

          // Custom tooltip behavior
          layer.on('mousemove', function (e) {
            const pos = e.originalEvent;
            const tooltipWidth = tooltipElement.offsetWidth;
            const windowWidth = window.innerWidth;

            let left = pos.pageX + 20;
            let top = pos.pageY - 20;

            // Check if the tooltip is too close to the right edge of the window
            if (pos.pageX + tooltipWidth + 20 > windowWidth) {
              tooltipElement.classList.add('positioned-left')
              left = pos.pageX - tooltipWidth - 20;
            } else {
              tooltipElement.classList.remove('positioned-left')
            }

            tooltipElement.style.left = left + 'px';
            tooltipElement.style.top = top + 'px';
          });

          // Show tooltip on mouseover
          layer.on('mouseover', function () {
            tooltipElement.style.visibility = 'visible';
          });

          // Hide tooltip on mouseout
          layer.on('mouseout', function () {
            tooltipElement.style.visibility = 'hidden';
          });

          // Prevent the tooltip from snapping back on click
          layer.on('click', function (e) {
            const countryName = feature.properties.name in countryData ? feature.properties.name : feature.properties.name2
            const row = {
              [config.query_fields.dimensions[0].name]: { value: countryName }
            }

            if (details.crossfilterEnabled) {
              LookerCharts.Utils.toggleCrossfilter({
                row,
              });
            }

            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
          });

          // Remove tooltip element when the layer is removed
          layer.on('remove', () => {
            document.body.removeChild(tooltipElement);
          });
        }
      }
    }).addTo(this.map)

    // Add Legend
    if (this.legend) {
      this.map.removeControl(this.legend);
    }

    this.legend = L.control({ position: 'bottomleft' });
    this.legend.onAdd = (map) => {
      const div = L.DomUtil.create('div', 'info legend');
      const labelContainer = L.DomUtil.create('div', 'label-container', div);
      const gradientContainer = L.DomUtil.create('div', 'gradient-container', div); // New container for gradient
      const valuesContainer = L.DomUtil.create('div', 'values-container', div); // New container for labels

      // Add label the labelContainer
      const label = config.show_full_measure_name ? config.query_fields.measures[0].label : config.query_fields.measures[0].label_short
      labelContainer.innerHTML = `<span class="label">${label}</span>`

      // Generate color gradient using the color scale
      for (let i = 0; i <= 100; i++) { // More steps for smoother gradient
        const color = colorScale(minValue + (maxValue - minValue) * i / 100).hex();
        gradientContainer.innerHTML += `<span style="background-color: ${color};"></span>`;
      }

      // Add values to the values container
      valuesContainer.innerHTML = `
          <span class="value min">${minValue.toLocaleString()}</span>
          <span class="value max">${maxValue.toLocaleString()}</span>
      `;

      return div;
    };
    this.legend.addTo(this.map);

    // Zoom controls
    if (config.enable_zoom) {
      this.map.zoomControl = true
      this.map.touchZoom.enable();
      this.map.doubleClickZoom.enable();
      this.map.scrollWheelZoom.enable();
      this.map.boxZoom.enable();
      this.map.keyboard.enable();
    } else {
      this.map.zoomControl = false
      this.map.touchZoom.disable();
      this.map.doubleClickZoom.disable();
      this.map.scrollWheelZoom.disable();
      this.map.boxZoom.disable();
      this.map.keyboard.disable();
    }

    if (config.enable_pan) {
      this.map.dragging.enable(); // Enable dragging for panning
    } else {
      this.map.dragging.disable(); // Disable dragging
    }

    const bounds = this.geojsonLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds);
    }

    done()
  }
});
