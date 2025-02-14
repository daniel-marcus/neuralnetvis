# NeuralNetVis

Wrap your head around neural networks and watch machines learning: NeuralNetVis is a platform for visualizing and exploring neural networks in your browser with [TensorFlow.js](https://github.com/tensorflow/tfjs) and [three.js](https://github.com/mrdoob/three.js).

Live here: [https://neuralnetvis.app](https://neuralnetvis.app)

## Datasets

These datasets are available at the moment:

- **[MNIST](https://en.wikipedia.org/wiki/MNIST_database)**
- **[Fashion MNIST](https://github.com/zalandoresearch/fashion-mnist)**
- **[CIFAR10](https://www.cs.toronto.edu/~kriz/cifar.html)**
- **[California Housing](https://keras.io/api/datasets/california_housing/)**

## Import pretrained models (experimental)

Pretrained models from Python Tensorflow can be exported via [tfjs-converter](https://github.com/tensorflow/tfjs/tree/master/tfjs-converter) and then imported in the _my models_ section.

Currently supported layer types: Dense, Conv2D, MaxPooling2D, Flatten and Dropout.

## Folder structure

- **app**: Layout and pages for Next.js App Router
- **components**: Main UI components
- **contents**: Lessons and specific UI elements for lessons
- **data**: Dataset definitions and all logic related to loading and storing datasets
- **model**: Everything related to TensorFlow.js and ML: model creation, training, activations, weights and biases
- **neuron-layers**: Here is where the current state get's poured into layers of neurons
- **scene**: Everything related to rendering the model with three.js
- **store**: The global Zustand store for state and settings
- **utils**: Everything else
