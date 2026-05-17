from flask import Flask, request, jsonify, render_template
from solver import simplify

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('select.html')


@app.route('/4var')
def kmap_4var():
    return render_template('index.html')


@app.route('/3var-ab-c')
def kmap_3var_ab_c():
    return render_template('kmap-3var-ab-c.html')


@app.route('/3var-a-bc')
def kmap_3var_a_bc():
    return render_template('kmap-3var-a-bc.html')


@app.route('/simplify', methods=['POST'])
def simplify_route():
    data = request.get_json()
    minterms = data.get('minterms', [])
    dont_cares = data.get('dont_cares', [])
    kmap_type = data.get('kmap_type', '4var')
    return jsonify(simplify(minterms, dont_cares, kmap_type))


def main():
    app.run(host='0.0.0.0', port=5000, debug=True)


if __name__ == '__main__':
    main()
